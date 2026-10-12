const { safeLog, safeError } = require("../utils/safeLogger");
const {CONSEQUENCES} = require ("../config/constants")

function handleLocation(session, normalizedMessage, context) {
    const rawLocation = normalizedMessage.text;

    if (
        typeof rawLocation !== "string" ||
        rawLocation.trim() === ""
    ) {
        safeLog(context, "Input rejected");

        return {
            reply:
                "⚠️ Necesito que indiques la ubicación específica del Near Miss.\n\n" +
                "Ejemplo:\n" +
                "Headers, Línea 2, Almacén o Pasillo principal."
        };
    }

    const location = rawLocation.trim();

    session.data.location = location;
    session.state = "CONSEQUENCE";
    session.updatedAt = new Date();

    

const Menuconsecuencia = Object.entries(CONSEQUENCES)
        .map(([code, name]) => `${code}. ${name}`)
        .join("\n");

safeLog(context, "State transition", { fromState: "LOCATION", toState: "CONSEQUENCE" });

    return {
        reply:
            "✅ Ubicación registrada.\n\n" +
            "Selecciona una o varias consecuencias potenciales:\n\n" +
            "Puedes seleccionar varias opciones separadas por coma.\n" +
            "Ejemplo: 1,2,6\n\n" +
            Menuconsecuencia
    };
}

module.exports = handleLocation;
