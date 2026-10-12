const { safeLog, safeError } = require("../utils/safeLogger");
function handleOtherConsequence(session, normalizedMessage, context) {
    const rawOtherConsequence = normalizedMessage.text;

    if (
        typeof rawOtherConsequence !== "string" ||
        rawOtherConsequence.trim() === ""
    ) {
        safeLog(context, "Input rejected");

        return {
            reply:
                "⚠️ Necesito que describas la otra consecuencia potencial.\n\n" +
                "Ejemplo:\n" +
                "Contacto eléctrico, lesión ocular u otra consecuencia."
        };
    }
    

    const otherConsequence = rawOtherConsequence.trim();

    session.data.otherConsequence = otherConsequence;

    session.state = "PREVENTION";
    session.updatedAt = new Date();

    

    safeLog(context, "State transition", { fromState: "OTHER_CONSEQUENCE", toState: "PREVENTION" });

    return {
        reply:
            "✅ Otra consecuencia registrada.\n\n" +
            "¿Qué acción o medida preventiva propones para evitar que ocurra un incidente?"
    };

}

module.exports = handleOtherConsequence;
