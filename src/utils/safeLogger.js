const EVENTS = new Set([
    "Webhook received", "Webhook verification requested", "Webhook verification succeeded",
    "Webhook verification rejected", "Webhook event ignored", "Twilio signature validated",
    "Twilio signature rejected", "Session loaded", "State transition", "Input rejected",
    "Image limit reached", "Image received", "Media continuation requested",
    "Report submission completed", "Evidence persistence completed", "Message duplicate",
    "Message claimed", "Session lock busy", "Session lock acquired", "Message receipt recovered",
    "Operation failed", "Report complete", "Unsupported state", "External request retry",
    "External request timed out"
]);
const STATES = new Set([
    "START", "IDENTITY", "AREA", "DESCRIPTION", "LOCATION", "CONSEQUENCE",
    "OTHER_CONSEQUENCE", "PREVENTION", "MEDIA_DECISION", "MEDIA", "MEDIA_MORE",
    "SUBMIT", "COMPLETE"
]);
const OPERATIONS = new Set([
    "webhook", "verification", "validation", "session", "session_save",
    "message_claim", "message_release", "message_complete", "lock", "lock_release",
    "heartbeat_stop", "submit", "evidence", "http"
]);
const ERROR_CODES = new Set([
    "TWILIO_VALIDATION_CONFIGURATION", "EXTERNAL_HTTP_TIMEOUT", "EXTERNAL_HTTP_NETWORK",
    "EVIDENCE_VALIDATION", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"
]);

function technicalMetadata(metadata) {
    const result = {};
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return result;
    for (const [key, value] of Object.entries(metadata)) {
        if (["state", "fromState", "toState"].includes(key) && STATES.has(value)) result[key] = value;
        else if (key === "operation" && OPERATIONS.has(value)) result[key] = value;
        else if (["reclaimed", "duplicate"].includes(key) && typeof value === "boolean") result[key] = value;
        else if (["attempt", "maxAttempts", "durationMs", "evidenceCount"].includes(key) &&
            typeof value === "number" && Number.isFinite(value) && value >= 0) result[key] = value;
        else if (key === "status" && Number.isInteger(value) && value >= 100 && value <= 599) result[key] = value;
    }
    return result;
}

function safeLog(context, event, metadata = {}) {
    if (!EVENTS.has(event)) throw new Error("Invalid technical log event");
    if (typeof context?.log === "function") {
        context.log({ event, ...technicalMetadata(metadata) });
    }
}

function safeError(context, event, error, metadata = {}) {
    if (!EVENTS.has(event)) throw new Error("Invalid technical log event");
    const record = { event, ...technicalMetadata(metadata) };
    if (ERROR_CODES.has(error?.code)) record.errorCode = error.code;
    const status = error?.statusCode ?? error?.status;
    if (Number.isInteger(status) && status >= 100 && status <= 599) record.status = status;
    if (typeof context?.error === "function") context.error(record);
}

module.exports = { safeLog, safeError };
