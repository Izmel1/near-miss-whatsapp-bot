function twimlResponse(message) {
    const escapedMessage = message
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    return {
        status: 200,
        headers: {
            "Content-Type": "text/xml; charset=utf-8"
        },
        body: '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<Response>\n' +
            '    <Message>' + escapedMessage + '</Message>\n' +
            '</Response>'
    };
}

module.exports = twimlResponse;
