const { safeLog, safeError } = require("../utils/safeLogger");
const parseArea = require("../utils/parseArea");
const { AREAS } = require("../config/constants");

function handleArea(session, normalizedMessage, context) {
    const result = parseArea(normalizedMessage.text);

    if (!result.valid) {
        safeLog(context, "Input rejected");

        const areaMenu = Object.entries(AREAS)
            .map(([code, name]) => `${code}. ${name}`)
            .join("\n");

        return {
            reply:
                "⚠️ La opción ingresada no es válida.\n\n" +
                "Escribe únicamente el número de la opción." +
                "Selecciona un área:\n\n" +
                areaMenu
                
        };
    }

    session.data.area = result.value;
    session.state = "DESCRIPTION";

    

    safeLog(context, "State transition", { fromState: "AREA", toState: "DESCRIPTION" });

    return {
        reply:
            `✅ Área registrada: ${result.value}\n\n` +
            "Describe brevemente la condición o situación insegura que detectaste.\n\n" +
            "Ejemplo:\n" +
            "Hay aceite derramado en el piso cerca de una máquina."
    };
}

module.exports = handleArea;



