const parseConsequences =
    require("../utils/parseConsequences");

function handleConsequence(session, normalizedMessage, context) {
        const result = parseConsequences(
        normalizedMessage.text
    );

    if (!result.valid) {
        context.log(
            "Consecuencia inválida:",
            normalizedMessage.text
        );

        context.log(
            "Opciones válidas: 1,2,3,4,5,6,7,8"
        );

        // No cambiamos de estado.
        return {
            reply:
                "⚠️ La opción ingresada no es válida.\n\n" +
                "Selecciona una o varias consecuencias potenciales:\n\n" +
                "1. Golpe\n" +
                "2. Caída\n" +
                "3. Atrapamiento\n" +
                "4. Cortadura\n" +
                "5. Quemadura\n" +
                "6. Derrame\n" +
                "7. Daño a equipo\n" +
                "8. Otro\n\n" +
                "Puedes seleccionar varias opciones separadas por coma.\n" +
                "Ejemplo: 1,2,6"
        };
    }

        session.data.consequences = result.values;
        session.updatedAt = new Date();

        context.log(
        "Consecuencias guardadas:",
        JSON.stringify(
            session.data.consequences
        )
    );

    if (
        session.data.consequences.includes("Otro")
    ) {
        session.state = "OTHER_CONSEQUENCE";

        context.log(
            "Cambio de estado: CONSEQUENCE -> OTHER_CONSEQUENCE"
        );

        return {
            reply:
                "✅ Consecuencias registradas:\n" +
                session.data.consequences
                    .map(value => "• " + value)
                    .join("\n") +
                "\n\nSeleccionaste \"Otro\".\n\n" +
                "Describe cuál sería la otra consecuencia potencial."
        };
    } else {
        session.state = "PREVENTION";

        context.log(
            "Cambio de estado: CONSEQUENCE -> PREVENTION"
        );

        return {
            reply:
                "✅ Consecuencias registradas:\n" +
                session.data.consequences
                    .map(value => "• " + value)
                    .join("\n") +
                "\n\n¿Qué acción o medida preventiva propones para evitar que ocurra un incidente?"
        };
    }

}

module.exports = handleConsequence;
