function handleOtherConsequence(session, normalizedMessage, context) {
    const rawOtherConsequence = normalizedMessage.text;

    if (
        typeof rawOtherConsequence !== "string" ||
        rawOtherConsequence.trim() === ""
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
    

    const otherConsequence = rawOtherConsequence.trim();

    session.data.otherConsequence = otherConsequence;

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
