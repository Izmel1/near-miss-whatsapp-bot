const { CONSEQUENCES } = require("../config/constants");

function parseConsequences(text) {
    if (text === null || text === undefined || text === "") {
        return {
            valid: false,
            values: []
        };
    }
    // Acepta espacios, comas, punto y coma o slash como separadores.
    const options = String(text)
        .split(/[\s,;/]+/)
        .map(x => x.trim())
        .filter(Boolean);

    if (options.length === 0) {
        return {
            valid: false,
            values: []
        };
    }

    const uniqueOptions = [...new Set(options)];

    const invalidOptions = uniqueOptions.filter(
        option => !Object.prototype.hasOwnProperty.call(CONSEQUENCES, option)
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
