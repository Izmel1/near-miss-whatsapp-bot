const { safeLog, safeError } = require("../utils/safeLogger");
function handleMediaDecision(session, normalizedMessage, context) {
    const rawOption = normalizedMessage.text;
    const option =
        normalizedMessage.type === "text" &&
        typeof rawOption === "string"
            ? rawOption.trim()
            : null;

    if (option === "1") {
        session.data.hasEvidence = false;
        session.data.images = [];
        session.state = "MEDIA";
        session.updatedAt = new Date();

        

        safeLog(context, "State transition", { fromState: "MEDIA_DECISION", toState: "MEDIA" });

        return {
            reply:
                "📷 Envía la primera fotografía como evidencia.\n\n" +
                "Puedes agregar hasta 5 imágenes.\n\n" +
                "Si deseas enviar multiples imagenes, envialas una a una.\n\n" +
                "\n\nSi cambias de opinión, también puedes escribir:\n" +
                "Continuar sin foto"
        };
    }

    if (option === "2") {
        session.data.hasEvidence = false;
        session.data.images = [];
        session.state = "SUBMIT";
        session.updatedAt = new Date();

        

        safeLog(context, "State transition", { fromState: "MEDIA_DECISION", toState: "SUBMIT" });

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
            "¿Deseas agregar fotografías como evidencia?\n\n" +
            "Escribe únicamente el número de la opción." +
            "1. Sí\n" +
            "2. No, enviar reporte"
    };

}

module.exports = handleMediaDecision;
