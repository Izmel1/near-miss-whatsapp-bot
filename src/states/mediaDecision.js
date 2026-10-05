function handleMediaDecision(session, normalizedMessage, context) {
    const option = normalizedMessage.text?.trim();

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

        return;
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

        return;
    }

    context.log(
        "Respuesta inválida en MEDIA_DECISION:",
        normalizedMessage.text
    );

    context.log(
        "Opciones válidas: 1 = Sí, 2 = No"
    );

}

module.exports = handleMediaDecision;
