const { AREAS } = require("../config/constants");

function parseArea(text) {
    if (text === null || text === undefined || text === "") {
        return { valid: false, value: null };
    }

    const option = String(text).trim();

    if (!option || !Object.prototype.hasOwnProperty.call(AREAS, option)) {
        return { valid: false, value: null };
    }

    return { valid: true, value: AREAS[option] };
}

module.exports = parseArea;
