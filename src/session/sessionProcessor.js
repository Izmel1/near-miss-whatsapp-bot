const handleStart = require("../states/start");
const handleIdentity = require("../states/identity");
const handleArea = require("../states/area");
const handleDescription = require("../states/description");
const handleLocation = require("../states/location");
const handleMediaMore =
    require("../states/mediaMore");
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
const submitReport = require("../services/submitReport");

async function processSession(session, normalizedMessage, context) {
    let result;
    switch (session.state) {

        case "START":
            result = handleStart(session, context);
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
        handleMediaMore(session, normalizedMessage, context);
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

    return result;
}

module.exports = processSession;
