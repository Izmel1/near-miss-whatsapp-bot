function handlePrevention(session, normalizedMessage, context) {
    const rawPrevention = normalizedMessage.text;

    if (
        typeof rawPrevention !== "string" ||
        rawPrevention.trim() === ""
    ) {
        context.log(
            "Propuesta preventiva vacía"
        );

        return {
            reply:
                "⚠️ Necesito que indiques una acción o medida preventiva.\n\n" +
                "Ejemplo:\n" +
                "Limpiar el derrame y colocar material antiderrapante."
        };
    }

    const prevention = rawPrevention.trim();

    session.data.prevention = prevention;

    session.state = "MEDIA_DECISION";
    session.updatedAt = new Date();

    

    context.log(
        "Propuesta preventiva guardada:",
        session.data.prevention
    );

    context.log(
        "Cambio de estado: PREVENTION -> MEDIA_DECISION"
    );

    return {
        reply:
            "✅ Medida preventiva registrada.\n\n" +
            "¿Deseas agregar fotografías como evidencia?\n\n" +
            "1. Sí\n" +
            "2. No, enviar reporte"
    };

}

module.exports = handlePrevention;
