function handleOtherConsequence(session, normalizedMessage, context) {
    if (
        !normalizedMessage.text ||
        normalizedMessage.text.trim() === ""
    ) {
        context.log(
            "Descripción de otra consecuencia vacía"
        );

        return {
            reply:
                "⚠️ Necesito que describas la otra consecuencia potencial.\n\n" +
                "Ejemplo:\n" +
                "Contacto eléctrico, lesión ocular u otra consecuencia."
        };
    }
    

    session.data.otherConsequence =
        normalizedMessage.text.trim();

    session.state = "PREVENTION";
    session.updatedAt = new Date();

    context.log(
        "Otra consecuencia guardada:",
        session.data.otherConsequence
    );

    context.log(
        "Cambio de estado: OTHER_CONSEQUENCE -> PREVENTION"
    );

    return {
        reply:
            "✅ Otra consecuencia registrada.\n\n" +
            "¿Qué acción o medida preventiva propones para evitar que ocurra un incidente?"
    };

}

module.exports = handleOtherConsequence;
