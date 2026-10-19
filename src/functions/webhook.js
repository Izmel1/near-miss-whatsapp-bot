const { safeLog, safeError } = require("../utils/safeLogger");
const { app } = require("@azure/functions");
const { validateTwilioWebhook } = require("../services/twilioWebhookValidationService");
const { getSession, getOrCreateSession, saveSession } = require("../session/sessionStore");
const { findMessageReceipt, recordMessageReceipt } = require("../services/sessionMessageReceiptService");
const { claimMessage, completeMessage, releaseMessage } = require("../services/messageIdempotencyService");
const { acquireSessionLock, releaseSessionLock, startSessionLockHeartbeat } = require("../services/sessionLockService");
const processSession =
    require("../session/sessionProcessor");
const submitReport = require("../services/submitReport");
const normalizeTwilioMessage =
    require("../channels/twilio/normalizeTwilioMessage");
const twimlResponse =
    require("../channels/twilio/twimlResponse");
const generateFolio = require("../utils/generateFolio");
const parseConsequences = require("../utils/parseConsequences");
const { CONSEQUENCES, ALLOWED_IMAGE_TYPES, VERIFY_TOKEN } = require("../config/constants");


// Sesiones persistidas en Azure Table Storage





app.http("webhook", {
    methods: ["GET", "POST"],
    authLevel: "anonymous",
    route: "webhook",

    handler: async (request, context) => {

        /*
        =====================================================
        GET - VERIFICACIÓN DE META
        =====================================================
        */

        if (request.method === "GET") {

            const mode = request.query.get("hub.mode");

            const token =
                request.query.get("hub.verify_token");

            const challenge =
                request.query.get("hub.challenge");

            safeLog(context, "Webhook verification requested");

            if (typeof VERIFY_TOKEN !== "string" || !VERIFY_TOKEN.trim()) {
                return { status: 500, body: "ERROR" };
            }

            if (
                mode === "subscribe" &&
                token === VERIFY_TOKEN
            ) {

                safeLog(context, "Webhook verification succeeded");

                return {
                    status: 200,
                    body: challenge
                };
            }

            safeLog(context, "Webhook verification rejected");

            return {
                status: 403,
                body: "Forbidden"
            };
        }

        /*
        =====================================================
        POST - RECEPCIÓN DE MENSAJES
        =====================================================
        */

        if (request.method === "POST") {
            let claimedMessageId;
            let claimToken;
            let lockedUserId;
            let lockToken;
            let heartbeat;

            try {

                const contentType = (request.headers.get("content-type") || "")
                    .split(";")[0].trim().toLowerCase();
                let normalizedMessage;

                safeLog(context, "Webhook received", { operation: "webhook" });

                // Twilio: los mensajes llegan como formulario URL-encoded.
                if (contentType === "application/x-www-form-urlencoded") {
                    const rawBody = await request.text();
                    const params = Object.create(null);
                    for (const [name, value] of new URLSearchParams(rawBody)) {
                        if (!Object.prototype.hasOwnProperty.call(params, name)) {
                            params[name] = value;
                        } else if (Array.isArray(params[name])) {
                            params[name].push(value);
                        } else {
                            params[name] = [params[name], value];
                        }
                    }
                    const signature = request.headers.get("X-Twilio-Signature");
                    if (!validateTwilioWebhook({ signature, params })) {
                        safeLog(context, "Twilio signature rejected", { status: 403 });
                        return { status: 403, body: "FORBIDDEN" };
                    }
                    safeLog(context, "Twilio signature validated", { operation: "validation" });
                    normalizedMessage = await normalizeTwilioMessage({ text: async () => rawBody });
                } else {
                    return { status: 415, body: "UNSUPPORTED_MEDIA_TYPE" };
                }

                if (!normalizedMessage.userId || !normalizedMessage.messageId) {
                    return { status: 400, body: "INVALID_MESSAGE" };
                }

                const isTwilio = contentType === "application/x-www-form-urlencoded";
                if (isTwilio) {
                    const claim = await claimMessage(normalizedMessage.messageId);
                    if (claim.status === "COMPLETED") {
                        safeLog(context, "Message duplicate", { duplicate: true, operation: "message_claim" });
                        return claim.reply !== null
                            ? twimlResponse(claim.reply)
                            : { status: 200, body: "EVENT_RECEIVED" };
                    }
                    if (claim.status === "PROCESSING") {
                        safeLog(context, "Message duplicate", { duplicate: true, operation: "message_claim" });
                        return {
                            status: 200,
                            headers: { "Content-Type": "text/xml; charset=utf-8" },
                            body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
                        };
                    }
                    claimedMessageId = normalizedMessage.messageId;
                    safeLog(context, "Message claimed", { reclaimed: claim.reclaimed, operation: "message_claim" });
                    claimToken = claim.token;
                    const lock = await acquireSessionLock(normalizedMessage.userId);
                    if (lock.status === "BUSY") {
                        safeLog(context, "Session lock busy", { operation: "lock", status: 503 });
                        await releaseMessage(claimedMessageId, claimToken);
                        claimedMessageId = undefined;
                        return { status: 503, body: "SESSION_BUSY" };
                    }
                    lockedUserId = normalizedMessage.userId;
                    safeLog(context, "Session lock acquired", { operation: "lock" });
                    lockToken = lock.token;
                    heartbeat = startSessionLockHeartbeat(lockedUserId, lockToken);
                    const persistedSession = await getSession(normalizedMessage.userId);
                    const receipt = persistedSession
                        ? findMessageReceipt(persistedSession, normalizedMessage.messageId)
                        : null;
                    if (receipt) {
                        safeLog(context, "Message receipt recovered", { duplicate: true });
                        heartbeat.throwIfFailed();
                        await completeMessage(normalizedMessage.messageId, claimToken, receipt.reply);
                        claimedMessageId = undefined;
                        return receipt.reply !== null
                            ? twimlResponse(receipt.reply)
                            : { status: 200, body: "EVENT_RECEIVED" };
                    }
                }

                /*
                =================================================
                SESIÓN
                =================================================
                */

                const session =
                    await getOrCreateSession(
                        normalizedMessage.userId
                    );

                

                safeLog(context, "Session loaded", { state: session.state });

                let result;
                let processingError;
                heartbeat?.throwIfFailed();
                try {
                    result = await processSession(session, normalizedMessage, context);
                    heartbeat?.throwIfFailed();
                    if (isTwilio) {
                        recordMessageReceipt(session, normalizedMessage.messageId, result?.reply ?? null);
                    }
                } catch (error) {
                    processingError = error;
                }
                heartbeat?.throwIfFailed();
                try {
                    await saveSession(normalizedMessage.userId, session);
                } catch (error) {
                    if (!processingError) throw error;
                    safeError(context, "Operation failed", undefined, { operation: "session_save" });
                }
                heartbeat?.throwIfFailed();
                if (processingError) throw processingError;
                if (isTwilio) {
                    heartbeat.throwIfFailed();
                    await completeMessage(normalizedMessage.messageId, claimToken, result?.reply ?? null);
                    claimedMessageId = undefined;
                }

                


                if (
                    contentType === "application/x-www-form-urlencoded" &&
                    result?.reply
                ) {
                    return twimlResponse(result.reply);
                }

                return {
                    status: 200,
                    body: "EVENT_RECEIVED"
                };

            } catch (error) {
                if (claimedMessageId) {
                    try {
                        await releaseMessage(claimedMessageId, claimToken);
                    } catch {
                        safeError(context, "Operation failed", undefined, { operation: "message_release" });
                    }
                }
                safeError(context, "Operation failed", error, { operation: "webhook" });

                return {
                    status: 500,
                    body: "ERROR"
                };
            } finally {
                if (heartbeat) {
                    try {
                        await heartbeat.stop();
                    } catch {
                        safeError(context, "Operation failed", undefined, { operation: "heartbeat_stop" });
                    }
                }
                if (lockToken) {
                    try {
                        await releaseSessionLock(lockedUserId, lockToken);
                    } catch {
                        safeError(context, "Operation failed", undefined, { operation: "lock_release" });
                    }
                }
            }
        }

        return {
            status: 405,
            body: "Method Not Allowed"
        };
    }
});
