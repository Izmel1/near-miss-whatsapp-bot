function handleArea(session, normalizedMessage, context) {
    session.data.area = normalizedMessage.text;
    session.state = "DESCRIPTION";

    context.log(
    "Área guardada:",
    session.data.area
);

    context.log(
    "Cambio de estado: AREA -> DESCRIPTION"
);
}

module.exports = handleArea;
