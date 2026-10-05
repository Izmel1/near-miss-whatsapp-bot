const { app } = require("@azure/functions");
const { getOrCreateSession } = require("../session/sessionStore");
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


// Sesiones temporales en memoria





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

            try {

                const contentType = (request.headers.get("content-type") || "")
                    .split(";")[0].trim().toLowerCase();
                let normalizedMessage;

                context.log(
                    "Webhook recibido"
                );

                // Twilio: los mensajes llegan como formulario URL-encoded.
                if (contentType === "application/x-www-form-urlencoded") {
                    normalizedMessage = await normalizeTwilioMessage(request);
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

                context.log(
                    "MENSAJE NORMALIZADO:"
                );

                context.log(
                    JSON.stringify(
                        normalizedMessage,
                        null,
                        2
                    )
                );

                /*
                =================================================
                SESIÓN
                =================================================
                */

                const session =
                    getOrCreateSession(
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

                const result = await processSession(
                    session,
                    normalizedMessage,
                    context
                );

                context.log(
                    "Estado después:",
                    session.state
                );

                context.log(
                    "Datos acumulados:",
                    JSON.stringify(
                        session.data,
                        null,
                        2
                    )
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

                context.error(
                    "Error procesando webhook:",
                    error
                );

                return {
                    status: 500,
                    body: "ERROR"
                };
            }
        }

        return {
            status: 405,
            body: "Method Not Allowed"
        };
    }
});