const handleStart = require("../states/start");
const handleIdentity = require("../states/identity");
const handleArea = require("../states/area");
const handleDescription = require("../states/description");
const handleLocation = require("../states/location");
const handleMedia =
    require("../states/media");
const handleMediaDecision =
    require("../states/mediaDecision");
const handlePrevention =
    require("../states/prevention");
const handleOtherConsequence =
    require("../states/otherConsequence");
const handleConsequence =
    require("../states/consequence");
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
            handleConsequence(session, normalizedMessage, context);
    break;
    }

        case "OTHER_CONSEQUENCE":
            handleOtherConsequence(session, normalizedMessage, context);
    break;

    case "PREVENTION":
        handlePrevention(session, normalizedMessage, context);
    break;

    case "MEDIA_DECISION": {
        handleMediaDecision(session, normalizedMessage, context);
    break;
}

    case "MEDIA": {
        handleMedia(session, normalizedMessage, context);
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
