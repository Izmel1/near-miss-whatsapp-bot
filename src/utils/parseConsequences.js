const { CONSEQUENCES } = require("../config/constants");

function parseConsequences(text) {
    if (!text) {
        return {
            valid: false,
            values: []
        };
    }
    // Acepta espacios, comas, punto y coma o slash como separadores.
    const options = text
    .split(/[\s,;/]+/)
    .map(x => x.trim())
    .filter(Boolean);

    const uniqueOptions = [...new Set(options)];

    const invalidOptions = uniqueOptions.filter(
        option => !CONSEQUENCES[option]
    );

    if (invalidOptions.length > 0) {
        return {
            valid: false,
            values: [],
            invalidOptions
        };
    }

    return {
        valid: true,
        values: uniqueOptions.map(
            option => CONSEQUENCES[option]
        )
    };
}

module.exports = parseConsequences;
