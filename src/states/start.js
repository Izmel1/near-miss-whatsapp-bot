function handleStart(session, context) {
    session.state = "IDENTITY";

    context.log("Cambio de estado: START -> IDENTITY");

    return {
        reply:
            "👋 Bienvenido al sistema de reporte Near Miss de Hudson Products.\n\n" +
            "Te guiaré para registrar una condición o situación insegura.\n\n" +
            "Por favor, ingresa tu número de empleado."
    };
}

module.exports = handleStart;
