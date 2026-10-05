const { app } = require("@azure/functions");
const crypto = require("crypto");
const generateFolio = require("../utils/generateFolio");
const { CONSEQUENCES, ALLOWED_IMAGE_TYPES, VERIFY_TOKEN } = require("../config/constants");


// Sesiones temporales en memoria
const sessions = new Map();

function parseConsequences(text) {
    if (!text) {
        return {
            valid: false,
            values: []
        };
    }
    // Acepta espacios, comas, punto y coma o slash como separadores.
    const options = text
    .split(/[\s,;/]+/)
    .map(x => x.trim())
    .filter(Boolean);

    const uniqueOptions = [...new Set(options)];

    const invalidOptions = uniqueOptions.filter(
        option => !CONSEQUENCES[option]
    );

    if (invalidOptions.length > 0) {
        return {
            valid: false,
            values: [],
            invalidOptions
        };
    }

    return {
        valid: true,
        values: uniqueOptions.map(
            option => CONSEQUENCES[option]
        )
    };
}

function getOrCreateSession(userId) {
    if (!sessions.has(userId)) {
        sessions.set(userId, {
            state: "START",
            eventId: crypto.randomUUID(),
            data: {},
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }

    return sessions.get(userId);
}

async function submitReport(session, context) {
    context.log("Inicio de SUBMIT: reporte listo para persistencia");
    context.log("Event ID:", session.eventId);
    context.log(
        "Datos finales:",
        JSON.stringify(session.data, null, 2)
    );

    session.state = "COMPLETE";
    session.updatedAt = new Date();

    context.log("Fin de SUBMIT: preparación del reporte completada");
    context.log("Cambio de estado: SUBMIT -> COMPLETE");
}

async function processSession(session, normalizedMessage, context) {
    switch (session.state) {

        case "START":
            session.state = "IDENTITY";

            context.log("Cambio de estado: START -> IDENTITY");
            break;

        case "IDENTITY":
            session.data.identity = normalizedMessage.text;
            session.state = "AREA";

            context.log(
                "Identidad guardada:",
                session.data.identity
            );

            context.log(
                "Cambio de estado: IDENTITY -> AREA"
            );
            break;

        case "AREA":
            session.data.area = normalizedMessage.text;
            session.state = "DESCRIPTION";

            context.log(
            "Área guardada:",
            session.data.area
        );

            context.log(
            "Cambio de estado: AREA -> DESCRIPTION"
        );
            break;

        case "DESCRIPTION":
            session.data.description = normalizedMessage.text;
            session.state = "LOCATION";
            session.updatedAt = new Date();

            context.log(
            "Descripción guardada:",
            session.data.description
            );

    context.log(
        "Cambio de estado: DESCRIPTION -> LOCATION"
    );
    break;

        case "LOCATION":
        session.data.location = normalizedMessage.text;
        session.state = "CONSEQUENCE";
        session.updatedAt = new Date();

        context.log(
        "Ubicación guardada:",
        session.data.location
    );

    context.log(
        "Cambio de estado: LOCATION -> CONSEQUENCE"
    );
    break;

        case "CONSEQUENCE": {
        const result = parseConsequences(
        normalizedMessage.text
    );

    if (!result.valid) {
        context.log(
            "Consecuencia inválida:",
            normalizedMessage.text
        );

        context.log(
            "Opciones válidas: 1,2,3,4,5,6,7,8"
        );

        // No cambiamos de estado.
        break;
    }

        session.data.consequences = result.values;
        session.updatedAt = new Date();

        context.log(
        "Consecuencias guardadas:",
        JSON.stringify(
            session.data.consequences
        )
    );

    if (
        session.data.consequences.includes("Otro")
    ) {
        session.state = "OTHER_CONSEQUENCE";

        context.log(
            "Cambio de estado: CONSEQUENCE -> OTHER_CONSEQUENCE"
        );
    } else {
        session.state = "PREVENTION";

        context.log(
            "Cambio de estado: CONSEQUENCE -> PREVENTION"
        );
    }

    break;
    }

        case "OTHER_CONSEQUENCE":
    if (
        !normalizedMessage.text ||
        normalizedMessage.text.trim() === ""
    ) {
        context.log(
            "Descripción de otra consecuencia vacía"
        );

        break;
    }
    

    session.data.otherConsequence =
        normalizedMessage.text.trim();

    session.state = "PREVENTION";
    session.updatedAt = new Date();

    context.log(
        "Otra consecuencia guardada:",
        session.data.otherConsequence
    );

    context.log(
        "Cambio de estado: OTHER_CONSEQUENCE -> PREVENTION"
    );

    break;

    case "PREVENTION":
    if (
        !normalizedMessage.text ||
        normalizedMessage.text.trim() === ""
    ) {
        context.log(
            "Propuesta preventiva vacía"
        );

        break;
    }

    session.data.prevention =
        normalizedMessage.text.trim();

    session.state = "MEDIA_DECISION";
    session.updatedAt = new Date();

    

    context.log(
        "Propuesta preventiva guardada:",
        session.data.prevention
    );

    context.log(
        "Cambio de estado: PREVENTION -> MEDIA_DECISION"
    );

    break;

    case "MEDIA_DECISION": {
    const option = normalizedMessage.text?.trim();

    if (option === "1") {
        session.data.hasEvidence = false;
        session.data.images = [];
        session.state = "MEDIA";
        session.updatedAt = new Date();

        context.log(
            "Usuario indicó que sí tiene fotografías"
        );

        context.log(
            "Cambio de estado: MEDIA_DECISION -> MEDIA"
        );

        break;
    }

    if (option === "2") {
        session.data.hasEvidence = false;
        session.data.images = [];
        session.state = "SUBMIT";
        session.updatedAt = new Date();

        context.log(
            "Usuario indicó que no tiene fotografías"
        );

        context.log(
            "Cambio de estado: MEDIA_DECISION -> SUBMIT"
        );

        break;
    }

    context.log(
        "Respuesta inválida en MEDIA_DECISION:",
        normalizedMessage.text
    );

    context.log(
        "Opciones válidas: 1 = Sí, 2 = No"
    );

    break;
}

    case "MEDIA": {

    // Inicializar arreglo de imágenes si aún no existe
    if (!session.data.images) {
        session.data.images = [];
    }

    /*
    ============================================
    SI EL USUARIO ENVÍA UNA IMAGEN
    ============================================
    */

    if (normalizedMessage.type === "image") {

        // Validar tipo de imagen
        if (
            !ALLOWED_IMAGE_TYPES.includes(
                normalizedMessage.mimeType
            )
        ) {
            context.log(
                "Formato de imagen no permitido:",
                normalizedMessage.mimeType
            );

            break;
        }

        // Máximo 5 fotografías
        if (session.data.images.length >= 5) {

            context.log(
                "Límite máximo de 5 imágenes alcanzado"
            );

            session.state = "SUBMIT";
            session.updatedAt = new Date();

            context.log(
                "Cambio de estado: MEDIA -> SUBMIT"
            );

            break;
        }

        

        // Guardamos por ahora los metadatos
        session.data.images.push({
            imageId: normalizedMessage.imageId,
            mediaUrl: normalizedMessage.mediaUrl,
            mimeType: normalizedMessage.mimeType,
            caption: normalizedMessage.caption,
            messageId: normalizedMessage.messageId,
            receivedAt: new Date().toISOString()
        });

        session.data.hasEvidence = true;
        session.updatedAt = new Date();

        context.log(
            "Imagen registrada:",
            normalizedMessage.imageId
        );

        context.log(
            "Total de imágenes:",
            session.data.images.length
        );

        // Si ya llegó a 5, avanzar automáticamente
        if (session.data.images.length === 5) {
        session.state = "SUBMIT";

        context.log(
        "Máximo de 5 imágenes recibido"
    );

        context.log(
        "Cambio de estado: MEDIA -> SUBMIT"
    );

    } else {
        session.state = "MEDIA_MORE";

        context.log(
        "Cambio de estado: MEDIA -> MEDIA_MORE"
    );

        context.log(
        "¿Deseas agregar más imágenes? 1 = Sí, 2 = Enviar reporte"
    );

    
}

        // Con menos de 5 imágenes pasa a MEDIA_MORE; con 5, a SUBMIT.
        break;
    }

    /*
    ============================================
    SI EL USUARIO ESCRIBE CONTINUAR
    ============================================
    */

    if (normalizedMessage.type === "text") {

        const text =
            normalizedMessage.text
                ?.trim()
                .toLowerCase();

        if (
            text === "continuar" ||
            text === "sin foto" ||
            text === "continuar sin foto"
        ) {

            session.data.hasEvidence =
                session.data.images.length > 0;

            session.state = "SUBMIT";
            session.updatedAt = new Date();

            context.log(
                "Usuario decidió continuar"
            );

            context.log(
                "Tiene evidencia:",
                session.data.hasEvidence
            );

            context.log(
                "Cambio de estado: MEDIA -> SUBMIT"
            );

            break;
        }


        context.log(
            "Entrada no válida en MEDIA:",
            normalizedMessage.text
        );

        context.log(
            "Debe enviar una imagen o escribir Continuar"
        );

        break;
    }

    context.log(
        "Tipo de mensaje no soportado en MEDIA:",
        normalizedMessage.type
    );

    break;
}
    case "MEDIA_MORE": {
    const option = normalizedMessage.text?.trim();

    if (option === "1") {
        session.state = "MEDIA";
        session.updatedAt = new Date();

        context.log(
            "Usuario desea agregar otra imagen"
        );

        context.log(
            "Cambio de estado: MEDIA_MORE -> MEDIA"
        );

        break;
    }

    if (option === "2") {
        session.state = "SUBMIT";
        session.updatedAt = new Date();

        context.log(
            "Usuario decidió enviar el reporte"
        );

        context.log(
            "Cambio de estado: MEDIA_MORE -> SUBMIT"
        );

        break;
    }

    context.log(
        "Respuesta inválida en MEDIA_MORE:",
        normalizedMessage.text
    );

    context.log(
        "Opciones válidas: 1 = Sí, 2 = Enviar reporte"
    );

    break;
}

case "SUBMIT":
    // Se procesa abajo, igual que las transiciones que llegan a SUBMIT.
    break;

case "COMPLETE":
    context.log("Reporte completado");

    break;

default:
    context.log(
        "Estado aún no implementado:",
        session.state
    );
    break;
    }

    // SUBMIT es inmediato: no requiere otro mensaje del usuario.
    if (session.state === "SUBMIT") {
        await submitReport(session, context);
    }

    session.updatedAt = new Date();
}

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
                    const form = new URLSearchParams(await request.text());
                    const messageId = form.get("MessageSid");
                    const bodyText = form.get("Body") || "";
                    const mimeType = form.get("MediaContentType0");
                    const isImage = Number(form.get("NumMedia") || 0) > 0 &&
                        (mimeType || "").startsWith("image/");

                    normalizedMessage = {
                        name: form.get("ProfileName") || "Sin nombre",
                        userId: form.get("From")?.replace(/^whatsapp:/, ""),
                        messageId,
                        type: isImage ? "image" : "text",
                        text: bodyText,
                        imageId: isImage ? `${messageId}:0` : null,
                        mediaUrl: isImage ? form.get("MediaUrl0") : null,
                        mimeType: isImage ? mimeType : null,
                        caption: isImage ? bodyText : null
                    };
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

                    const type =
                        message.type;

                    normalizedMessage = {

                        name:
                            contact?.profile?.name ||
                            "Sin nombre",

                        userId:
                            message.from,

                        messageId:
                            message.id,

                        type: type,

                        text:
                            type === "text"
                                ? message.text?.body
                                : null,

                        imageId:
                            type === "image"
                                ? message.image?.id
                                : null,

                        mimeType:
                            type === "image"
                                ? message.image?.mime_type
                                : null,

                        caption:
                            type === "image"
                                ? message.image?.caption || null
                                : null
                    };
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

                await processSession(
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