function handleStart(session, context) {
    session.state = "IDENTITY";

    context.log("Cambio de estado: START -> IDENTITY");
}

module.exports = handleStart;
