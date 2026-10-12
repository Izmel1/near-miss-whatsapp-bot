const twilio = require("twilio");

function validateTwilioWebhook({ signature, params } = {}) {
    const token = process.env.TWILIO_AUTH_TOKEN;
    const url = process.env.TWILIO_WEBHOOK_URL;
    let configured = typeof token === "string" && token.trim() &&
        typeof url === "string" && url.trim() && url === url.trim();
    if (configured) {
        try {
            const parsed = new URL(url);
            configured = parsed.protocol === "https:" && !parsed.username &&
                !parsed.password && !parsed.hash;
        } catch {
            configured = false;
        }
    }
    if (!configured) {
        const error = new Error("Twilio webhook validation is not configured");
        error.code = "TWILIO_VALIDATION_CONFIGURATION";
        throw error;
    }
    if (typeof signature !== "string" || !signature.trim()) return false;
    if (!params || typeof params !== "object" || Array.isArray(params)) return false;
    try {
        return twilio.validateRequest(token, signature, url, params);
    } catch {
        return false;
    }
}

module.exports = { validateTwilioWebhook };
