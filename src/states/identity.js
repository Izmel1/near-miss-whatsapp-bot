function handleIdentity(session, normalizedMessage, context) {
    session.data.identity = normalizedMessage.text;
    session.state = "AREA";

    context.log(
        "Identidad guardada:",
        session.data.identity
    );

    context.log(
        "Cambio de estado: IDENTITY -> AREA"
    );
}

module.exports = handleIdentity;
