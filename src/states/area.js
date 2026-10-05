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

    return {
        reply:
            "✅ Área registrada.\n\n" +
            "Describe brevemente la condición o situación insegura que detectaste.\n\n" +
            "Ejemplo:\n" +
            "Hay aceite derramado en el piso cerca de una máquina."
    };
}

module.exports = handleArea;
