function handleOtherConsequence(session, normalizedMessage, context) {
    if (
        !normalizedMessage.text ||
        normalizedMessage.text.trim() === ""
    ) {
        context.log(
            "Descripción de otra consecuencia vacía"
        );

        return;
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

}

module.exports = handleOtherConsequence;
