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

        return;
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

        return;
    }

    context.log(
        "Respuesta inválida en MEDIA_MORE:",
        normalizedMessage.text
    );

    context.log(
        "Opciones válidas: 1 = Sí, 2 = Enviar reporte"
    );

}

module.exports = handleMediaMore;
