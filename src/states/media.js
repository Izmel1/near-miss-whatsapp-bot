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

            return {
                reply:
                    "⚠️ El formato de la imagen no es válido.\n\n" +
                    "Envía una fotografía en formato JPG, JPEG o PNG."
            };
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

            return {
                reply:
                    "✅ Se alcanzó el máximo de 5 fotografías.\n\n" +
                    "La captura del Near Miss está completa y el reporte está listo para su registro.\n\n" +
                    "La confirmación con folio se habilitará al integrar SharePoint."
            };
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
        return {
            reply: session.data.images.length === 5
                ? ("✅ Fotografía recibida (5 de 5).\n\n" +
                "Alcanzaste el máximo de fotografías.\n\n" +
                "La captura del Near Miss está completa y el reporte está listo para su registro.\n\n" +
                "La confirmación con folio se habilitará al integrar SharePoint.")
                : ("✅ Fotografía recibida (" +
                session.data.images.length +
                " de 5).\n\n" +
                "¿Deseas agregar más imágenes?\n\n" +
                "1. Sí\n" +
                "2. Enviar reporte")
        };
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

            return {
                reply:
                    "✅ Captura del Near Miss completada.\n\n" +
                    "El reporte está listo para su registro.\n\n" +
                    "La confirmación con folio se habilitará al integrar SharePoint."
            };
        }


        context.log(
            "Entrada no válida en MEDIA:",
            normalizedMessage.text
        );

        context.log(
            "Debe enviar una imagen o escribir Continuar"
        );

        return {
            reply:
                "⚠️ En este momento debes enviar una fotografía.\n\n" +
                "También puedes escribir:\n" +
                "Continuar sin foto"
        };
    }

    context.log(
        "Tipo de mensaje no soportado en MEDIA:",
        normalizedMessage.type
    );

    return {
        reply:
            "⚠️ Ese tipo de mensaje no está soportado.\n\n" +
            "Envía una fotografía JPG, JPEG o PNG, o escribe:\n" +
            "Continuar sin foto"
    };

}

module.exports = handleMedia;
