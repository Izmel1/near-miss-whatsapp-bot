const handleStart = require("../states/start");
const handleIdentity = require("../states/identity");
const handleArea = require("../states/area");
const handleDescription = require("../states/description");
const handleLocation = require("../states/location");
const parseConsequences = require("../utils/parseConsequences");
const submitReport = require("../services/submitReport");
const { ALLOWED_IMAGE_TYPES } = require("../config/constants");

async function processSession(session, normalizedMessage, context) {
    switch (session.state) {

        case "START":
            handleStart(session, context);
            break;

        case "IDENTITY":
            handleIdentity(session, normalizedMessage, context);
            break;

        case "AREA":
            handleArea(session, normalizedMessage, context);
            break;

        case "DESCRIPTION":
            handleDescription(session, normalizedMessage, context);
    break;

        case "LOCATION":
            handleLocation(session, normalizedMessage, context);
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

module.exports = processSession;
