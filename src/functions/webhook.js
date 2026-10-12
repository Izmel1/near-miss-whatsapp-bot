const { app } = require("@azure/functions");
const { validateTwilioWebhook } = require("../services/twilioWebhookValidationService");
const { getSession, getOrCreateSession, saveSession } = require("../session/sessionStore");
const { findMessageReceipt, recordMessageReceipt } = require("../services/sessionMessageReceiptService");
const { claimMessage, completeMessage, releaseMessage } = require("../services/messageIdempotencyService");
const { acquireSessionLock, releaseSessionLock, startSessionLockHeartbeat } = require("../services/sessionLockService");
const processSession =
    require("../session/sessionProcessor");
const submitReport = require("../services/submitReport");
const normalizeMetaMessage =
    require("../channels/meta/normalizeMetaMessage");
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

            context.log(
                "Intento de verificación recibido"
            );

            if (
                mode === "subscribe" &&
                token === VERIFY_TOKEN
            ) {

                context.log(
                    "Webhook verificado correctamente"
                );

                return {
                    status: 200,
                    body: challenge
                };
            }

            context.log(
                "Verificación rechazada"
            );

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

                context.log(
                    "Webhook recibido"
                );

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
                        context.log("Invalid Twilio webhook signature");
                        return { status: 403, body: "FORBIDDEN" };
                    }
                    normalizedMessage = await normalizeTwilioMessage({ text: async () => rawBody });
                } else {
                    // Meta y simulaciones: se conserva la lectura del JSON actual.
                    const body = await request.json();

                    const entry =
                        body.entry?.[0];

                    const change =
                        entry?.changes?.[0];

                    const value =
                        change?.value;

                    const message =
                        value?.messages?.[0];

                    const contact =
                        value?.contacts?.[0];

                    /*
                    Meta también manda eventos que no contienen
                    mensajes, por ejemplo estados.
                    */

                    if (!message) {

                        context.log(
                            "No se encontró mensaje en el payload"
                        );

                        return {
                            status: 200,
                            body: "EVENT_RECEIVED"
                        };
                    }

                    /*
                    =================================================
                    NORMALIZACIÓN
                    =================================================
                    */

                    normalizedMessage = normalizeMetaMessage(message, contact);
                }

                if (!normalizedMessage.userId || !normalizedMessage.messageId) {
                    return { status: 400, body: "INVALID_MESSAGE" };
                }

                const isTwilio = contentType === "application/x-www-form-urlencoded";
                if (isTwilio) {
                    const claim = await claimMessage(normalizedMessage.messageId);
                    if (claim.status === "COMPLETED") {
                        return claim.reply !== null
                            ? twimlResponse(claim.reply)
                            : { status: 200, body: "EVENT_RECEIVED" };
                    }
                    if (claim.status === "PROCESSING") {
                        return {
                            status: 200,
                            headers: { "Content-Type": "text/xml; charset=utf-8" },
                            body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
                        };
                    }
                    claimedMessageId = normalizedMessage.messageId;
                    claimToken = claim.token;
                    const lock = await acquireSessionLock(normalizedMessage.userId);
                    if (lock.status === "BUSY") {
                        await releaseMessage(claimedMessageId, claimToken);
                        claimedMessageId = undefined;
                        return { status: 503, body: "SESSION_BUSY" };
                    }
                    lockedUserId = normalizedMessage.userId;
                    lockToken = lock.token;
                    heartbeat = startSessionLockHeartbeat(lockedUserId, lockToken);
                    const persistedSession = await getSession(normalizedMessage.userId);
                    const receipt = persistedSession
                        ? findMessageReceipt(persistedSession, normalizedMessage.messageId)
                        : null;
                    if (receipt) {
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

                context.log(
                    "Event ID:",
                    session.eventId
                );

                context.log(
                    "Estado antes:",
                    session.state
                );

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
                    context.error("Failed to save session after processing failure");
                }
                heartbeat?.throwIfFailed();
                if (processingError) throw processingError;
                if (isTwilio) {
                    heartbeat.throwIfFailed();
                    await completeMessage(normalizedMessage.messageId, claimToken, result?.reply ?? null);
                    claimedMessageId = undefined;
                }

                context.log(
                    "Estado después:",
                    session.state
                );


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
                        context.error("Failed to release message idempotency claim");
                    }
                }
                context.error(error?.code === "TWILIO_VALIDATION_CONFIGURATION"
                    ? "Twilio webhook validation is not configured"
                    : "Error procesando webhook");

                return {
                    status: 500,
                    body: "ERROR"
                };
            } finally {
                if (heartbeat) {
                    try {
                        await heartbeat.stop();
                    } catch {
                        context.error("Failed to stop session lock heartbeat");
                    }
                }
                if (lockToken) {
                    try {
                        await releaseSessionLock(lockedUserId, lockToken);
                    } catch {
                        context.error("Failed to release session lock");
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
