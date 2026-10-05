function handlePrevention(session, normalizedMessage, context) {
    if (
        !normalizedMessage.text ||
        normalizedMessage.text.trim() === ""
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

    session.data.prevention =
        normalizedMessage.text.trim();

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
