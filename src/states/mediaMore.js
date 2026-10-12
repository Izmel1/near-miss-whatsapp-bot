const { safeLog, safeError } = require("../utils/safeLogger");
const handleMedia = require("./media");

function handleMediaMore(session, normalizedMessage, context) {
    if (normalizedMessage.type === "image") {
        

        return handleMedia(session, normalizedMessage, context);
    }

    const rawOption = normalizedMessage.text;
    const option =
        normalizedMessage.type === "text" &&
        typeof rawOption === "string"
            ? rawOption.trim()
            : null;

    if (option === "1") {
        session.state = "MEDIA";
        session.updatedAt = new Date();

        

        safeLog(context, "State transition", { fromState: "MEDIA_MORE", toState: "MEDIA" });

        return {
            reply:
                "📷 Envía la siguiente fotografía.\n\n" +
                "Puedes agregar hasta 5 imágenes en total."
        };
    }

    if (option === "2") {
        session.state = "SUBMIT";
        session.updatedAt = new Date();

        

        safeLog(context, "State transition", { fromState: "MEDIA_MORE", toState: "SUBMIT" });

        return {
            reply:
                "✅ Captura del Near Miss completada.\n\n" +
                "El reporte está listo para su registro.\n\n" +
                "La confirmación con folio se habilitará al integrar SharePoint."
        };
    }

    safeLog(context, "Input rejected");

    

    return {
        reply:
            "⚠️ Selecciona una opción válida.\n\n" +
            "¿Deseas agregar más imágenes?\n\n" +
            "Escribe únicamente el número de la opción.\n\n" +
            "1. Sí\n" +
            "2. Enviar reporte"
    };

}

module.exports = handleMediaMore;
