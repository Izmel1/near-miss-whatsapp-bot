const { safeLog, safeError } = require("../utils/safeLogger");
const {AREAS} = require ("../config/constants");

function handleIdentity(session, normalizedMessage, context) {
    const rawIdentity = normalizedMessage.text;

    if (
        typeof rawIdentity !== "string" ||
        rawIdentity.trim() === ""
    ) {
        safeLog(context, "Input rejected");

        return {
            reply:
                "⚠️ Necesito que ingreses tu número de empleado.\n\n" +
                "Escríbelo para continuar con el reporte."
        };
    }

    const identity = rawIdentity.trim();

    session.data.identity = identity;
    session.state = "AREA";

    

    safeLog(context, "State transition", { fromState: "IDENTITY", toState: "AREA" });

    const areaMenu = Object.entries(AREAS)
        .map(([code, name]) => `${code}. ${name}`)
        .join("\n");


    return {
        reply:
            "✅ Identificación registrada.\n\n" +
            "¿En qué área ocurrió o detectaste el Near Miss?\n\n" +
            "Escribe únicamente el número de la opción." + "\n\n" +
            areaMenu
            
    };
}

module.exports = handleIdentity;
