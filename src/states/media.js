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
        const mediaItems = Array.isArray(normalizedMessage.mediaItems) &&
            normalizedMessage.mediaItems.length > 0
                ? normalizedMessage.mediaItems
                : [normalizedMessage];
        const previousState = session.state;
        let accepted = 0;
        let allowedFound = false;

        for (const item of mediaItems) {
            if (!ALLOWED_IMAGE_TYPES.includes(item?.mimeType)) {
                context.log("Formato de imagen no permitido:", item?.mimeType);
                continue;
            }

            allowedFound = true;
            if (session.data.images.length >= 5) {
                context.log("Límite máximo de 5 imágenes alcanzado");
                break;
            }

            // Por ahora se almacenan únicamente los metadatos.
            session.data.images.push({
                imageId: item.imageId,
                mediaUrl: item.mediaUrl,
                mimeType: item.mimeType,
                caption: item.caption,
                messageId: item.messageId,
                receivedAt: new Date().toISOString()
            });
            accepted++;
            session.data.hasEvidence = true;
            session.updatedAt = new Date();
            context.log("Imagen registrada:", item.imageId);
            context.log("Total de imágenes:", session.data.images.length);
        }

        if (!allowedFound) {
            return {
                reply:
                    "⚠️ El formato de la imagen no es válido.\n\n" +
                    "Envía una fotografía en formato JPG, JPEG o PNG."
            };
        }

        const received = accepted > 1 ? "Fotografías recibidas" : "Fotografía recibida";
        if (session.data.images.length >= 5) {
            session.state = "SUBMIT";
            session.updatedAt = new Date();
            context.log("Máximo de 5 imágenes recibido");
            context.log(`Cambio de estado: ${previousState} -> SUBMIT`);

            return {
                reply: (accepted === 0
                    ? "✅ Se alcanzó el máximo de 5 fotografías.\n\n"
                    : `✅ ${received} (5 de 5).\n\nAlcanzaste el máximo de fotografías.\n\n`) +
                    "La captura del Near Miss está completa y el reporte está listo para su registro.\n\n" +
                    "La confirmación con folio se habilitará al integrar SharePoint."
            };
        }

        session.state = "MEDIA_MORE";
        context.log(`Cambio de estado: ${previousState} -> MEDIA_MORE`);
        context.log("¿Deseas agregar más imágenes? 1 = Sí, 2 = Enviar reporte");

        return {
            reply:
                `✅ ${received} (${session.data.images.length} de 5).\n\n` +
                "¿Deseas agregar más imágenes?\n\n" +
                "1. Sí\n" +
                "2. Enviar reporte"
        };
    }

    /*
    ============================================
    SI EL USUARIO ESCRIBE CONTINUAR
    ============================================
    */

    if (normalizedMessage.type === "text") {

        const rawText = normalizedMessage.text;
        const text =
            typeof rawText === "string"
                ? rawText.trim().toLowerCase()
                : null;

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
