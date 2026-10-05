function handleDescription(session, normalizedMessage, context) {
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
}

module.exports = handleDescription;
