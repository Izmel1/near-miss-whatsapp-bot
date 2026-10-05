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

    return {
        reply:
            "✅ Ubicación registrada.\n\n" +
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

module.exports = handleLocation;
