function handleLocation(session, normalizedMessage, context) {
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
}

module.exports = handleLocation;
