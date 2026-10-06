function handleDescription(session, normalizedMessage, context) {
        const rawDescription = normalizedMessage.text;

        if (
            typeof rawDescription !== "string" ||
            rawDescription.trim() === ""
        ) {
            context.log("Descripción inválida");

            return {
                reply:
                    "⚠️ Necesito que describas la condición o situación insegura.\n\n" +
                    "Ejemplo:\n" +
                    "Hay aceite derramado en el piso cerca de una máquina."
            };
        }

        const description = rawDescription.trim();

        session.data.description = description;
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
