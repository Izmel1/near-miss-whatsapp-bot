function handlePrevention(session, normalizedMessage, context) {
    if (
        !normalizedMessage.text ||
        normalizedMessage.text.trim() === ""
    ) {
        context.log(
            "Propuesta preventiva vacía"
        );

        return;
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

}

module.exports = handlePrevention;
