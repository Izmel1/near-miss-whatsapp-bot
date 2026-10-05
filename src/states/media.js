const { ALLOWED_IMAGE_TYPES } =
    require("../config/constants");

function handleMedia(session, normalizedMessage, context) {

    // Inicializar arreglo de imágenes si aún no existe
    if (!session.data.images) {
        session.data.images = [];
    }

    /*
    ============================================
    SI EL USUARIO ENVÍA UNA IMAGEN
    ============================================
    */

    if (normalizedMessage.type === "image") {

        // Validar tipo de imagen
        if (
            !ALLOWED_IMAGE_TYPES.includes(
                normalizedMessage.mimeType
            )
        ) {
            context.log(
                "Formato de imagen no permitido:",
                normalizedMessage.mimeType
            );

            return;
        }

        // Máximo 5 fotografías
        if (session.data.images.length >= 5) {

            context.log(
                "Límite máximo de 5 imágenes alcanzado"
            );

            session.state = "SUBMIT";
            session.updatedAt = new Date();

            context.log(
                "Cambio de estado: MEDIA -> SUBMIT"
            );

            return;
        }

        

        // Guardamos por ahora los metadatos
        session.data.images.push({
            imageId: normalizedMessage.imageId,
            mediaUrl: normalizedMessage.mediaUrl,
            mimeType: normalizedMessage.mimeType,
            caption: normalizedMessage.caption,
            messageId: normalizedMessage.messageId,
            receivedAt: new Date().toISOString()
        });

        session.data.hasEvidence = true;
        session.updatedAt = new Date();

        context.log(
            "Imagen registrada:",
            normalizedMessage.imageId
        );

        context.log(
            "Total de imágenes:",
            session.data.images.length
        );

        // Si ya llegó a 5, avanzar automáticamente
        if (session.data.images.length === 5) {
        session.state = "SUBMIT";

        context.log(
        "Máximo de 5 imágenes recibido"
    );

        context.log(
        "Cambio de estado: MEDIA -> SUBMIT"
    );

    } else {
        session.state = "MEDIA_MORE";

        context.log(
        "Cambio de estado: MEDIA -> MEDIA_MORE"
    );

        context.log(
        "¿Deseas agregar más imágenes? 1 = Sí, 2 = Enviar reporte"
    );

    
}

        // Con menos de 5 imágenes pasa a MEDIA_MORE; con 5, a SUBMIT.
        return;
    }

    /*
    ============================================
    SI EL USUARIO ESCRIBE CONTINUAR
    ============================================
    */

    if (normalizedMessage.type === "text") {

        const text =
            normalizedMessage.text
                ?.trim()
                .toLowerCase();

        if (
            text === "continuar" ||
            text === "sin foto" ||
            text === "continuar sin foto"
        ) {

            session.data.hasEvidence =
                session.data.images.length > 0;

            session.state = "SUBMIT";
            session.updatedAt = new Date();

            context.log(
                "Usuario decidió continuar"
            );

            context.log(
                "Tiene evidencia:",
                session.data.hasEvidence
            );

            context.log(
                "Cambio de estado: MEDIA -> SUBMIT"
            );

            return;
        }


        context.log(
            "Entrada no válida en MEDIA:",
            normalizedMessage.text
        );

        context.log(
            "Debe enviar una imagen o escribir Continuar"
        );

        return;
    }

    context.log(
        "Tipo de mensaje no soportado en MEDIA:",
        normalizedMessage.type
    );

}

module.exports = handleMedia;
