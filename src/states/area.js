const parseArea = require("../utils/parseArea");
const { AREAS } = require("../config/constants");

function handleArea(session, normalizedMessage, context) {
    const result = parseArea(normalizedMessage.text);

    if (!result.valid) {
        context.log("Área inválida:", normalizedMessage.text);

        const areaMenu = Object.entries(AREAS)
            .map(([code, name]) => `${code}. ${name}`)
            .join("\n");

        return {
            reply:
                "⚠️ La opción ingresada no es válida.\n\n" +
                "Selecciona un área:\n\n" +
                areaMenu + "\n\n" +
                "Escribe únicamente el número de la opción."
        };
    }

    session.data.area = result.value;
    session.state = "DESCRIPTION";

    context.log(
    "Área guardada:",
    session.data.area
);

    context.log(
    "Cambio de estado: AREA -> DESCRIPTION"
);

    return {
        reply:
            `✅ Área registrada: ${result.value}\n\n` +
            "Describe brevemente la condición o situación insegura que detectaste.\n\n" +
            "Ejemplo:\n" +
            "Hay aceite derramado en el piso cerca de una máquina."
    };
}

module.exports = handleArea;



