function handleIdentity(session, normalizedMessage, context) {
    session.data.identity = normalizedMessage.text;
    session.state = "AREA";

    context.log(
        "Identidad guardada:",
        session.data.identity
    );

    context.log(
        "Cambio de estado: IDENTITY -> AREA"
    );

    return {
        reply:
            "✅ Identificación registrada.\n\n" +
            "¿En qué área ocurrió o detectaste el Near Miss?\n\n" +
            "Escribe el nombre del área.\n" +
            "Ejemplo: Producción, Headers, Almacén u Oficinas."
    };
}

module.exports = handleIdentity;
