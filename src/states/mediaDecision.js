function handleMediaDecision(session, normalizedMessage, context) {
    const rawOption = normalizedMessage.text;
    const option = typeof rawOption === "string" ? rawOption.trim() : null;

    if (option === "1") {
        session.data.hasEvidence = false;
        session.data.images = [];
        session.state = "MEDIA";
        session.updatedAt = new Date();

        context.log(
            "Usuario indicó que sí tiene fotografías"
        );

        context.log(
            "Cambio de estado: MEDIA_DECISION -> MEDIA"
        );

        return {
            reply:
                "📷 Envía la primera fotografía como evidencia.\n\n" +
                "Puedes agregar hasta 5 imágenes.\n\n" +
                "Si cambias de opinión, también puedes escribir:\n" +
                "Continuar sin foto"
        };
    }

    if (option === "2") {
        session.data.hasEvidence = false;
        session.data.images = [];
        session.state = "SUBMIT";
        session.updatedAt = new Date();

        context.log(
            "Usuario indicó que no tiene fotografías"
        );

        context.log(
            "Cambio de estado: MEDIA_DECISION -> SUBMIT"
        );

        return {
            reply:
                "✅ Captura del Near Miss completada.\n\n" +
                "El reporte está listo para su registro.\n\n" +
                "La confirmación con folio se habilitará al integrar SharePoint."
        };
    }

    context.log(
        "Respuesta inválida en MEDIA_DECISION:",
        normalizedMessage.text
    );

    context.log(
        "Opciones válidas: 1 = Sí, 2 = No"
    );

    return {
        reply:
            "⚠️ Selecciona una opción válida.\n\n" +
            "¿Deseas agregar fotografías como evidencia?\n\n" +
            "1. Sí\n" +
            "2. No, enviar reporte"
    };

}

module.exports = handleMediaDecision;
