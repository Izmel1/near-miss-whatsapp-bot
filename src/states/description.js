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

    return {
        reply:
            "✅ Descripción registrada.\n\n" +
            "¿En qué ubicación específica ocurrió o detectaste el Near Miss?\n\n" +
            "Ejemplo:\n" +
            "Headers, Línea 2, Almacén, Pasillo principal u otra ubicación."
    };
}

module.exports = handleDescription;
