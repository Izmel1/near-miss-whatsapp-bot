function handleMediaMore(session, normalizedMessage, context) {
    const option = normalizedMessage.text?.trim();

    if (option === "1") {
        session.state = "MEDIA";
        session.updatedAt = new Date();

        context.log(
            "Usuario desea agregar otra imagen"
        );

        context.log(
            "Cambio de estado: MEDIA_MORE -> MEDIA"
        );

        return {
            reply:
                "📷 Envía la siguiente fotografía.\n\n" +
                "Puedes agregar hasta 5 imágenes en total."
        };
    }

    if (option === "2") {
        session.state = "SUBMIT";
        session.updatedAt = new Date();

        context.log(
            "Usuario decidió enviar el reporte"
        );

        context.log(
            "Cambio de estado: MEDIA_MORE -> SUBMIT"
        );

        return {
            reply:
                "✅ Captura del Near Miss completada.\n\n" +
                "El reporte está listo para su registro.\n\n" +
                "La confirmación con folio se habilitará al integrar SharePoint."
        };
    }

    context.log(
        "Respuesta inválida en MEDIA_MORE:",
        normalizedMessage.text
    );

    context.log(
        "Opciones válidas: 1 = Sí, 2 = Enviar reporte"
    );

    return {
        reply:
            "⚠️ Selecciona una opción válida.\n\n" +
            "¿Deseas agregar más imágenes?\n\n" +
            "1. Sí\n" +
            "2. Enviar reporte"
    };

}

module.exports = handleMediaMore;
