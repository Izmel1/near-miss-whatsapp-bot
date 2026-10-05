const parseConsequences =
    require("../utils/parseConsequences");

function handleConsequence(session, normalizedMessage, context) {
        const result = parseConsequences(
        normalizedMessage.text
    );

    if (!result.valid) {
        context.log(
            "Consecuencia inválida:",
            normalizedMessage.text
        );

        context.log(
            "Opciones válidas: 1,2,3,4,5,6,7,8"
        );

        // No cambiamos de estado.
        return;
    }

        session.data.consequences = result.values;
        session.updatedAt = new Date();

        context.log(
        "Consecuencias guardadas:",
        JSON.stringify(
            session.data.consequences
        )
    );

    if (
        session.data.consequences.includes("Otro")
    ) {
        session.state = "OTHER_CONSEQUENCE";

        context.log(
            "Cambio de estado: CONSEQUENCE -> OTHER_CONSEQUENCE"
        );
    } else {
        session.state = "PREVENTION";

        context.log(
            "Cambio de estado: CONSEQUENCE -> PREVENTION"
        );
    }

}

module.exports = handleConsequence;
