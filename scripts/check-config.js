// Presence/format audit only. Never print environment values or contact services.
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nonempty = value => typeof value === "string" && !!value.trim() && !/[\x00-\x1f\x7f]/.test(value);
const table = value => /^[A-Za-z][A-Za-z0-9]{2,62}$/.test(value);
const integer = (min, max) => value => /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max;
function webhookUrl(value) {
    try {
        const url = new URL(value);
        return value === value.trim() && url.protocol === "https:" && !url.username && !url.password && !url.hash;
    } catch { return false; }
}
function storageConnection(value) {
    if (value === "UseDevelopmentStorage=true") return true;
    if (!nonempty(value)) return false;
    const parts = Object.fromEntries(value.split(";").filter(Boolean).map(part => {
        const index = part.indexOf("=");
        return index > 0 ? [part.slice(0, index), part.slice(index + 1)] : ["", ""];
    }));
    const key = parts.AccountKey && /^[A-Za-z0-9+/]+={0,2}$/.test(parts.AccountKey);
    const sas = parts.SharedAccessSignature && /(?:^|&)sig=[^&]+/.test(parts.SharedAccessSignature);
    if (!key && !sas) return false;
    if (parts.TableEndpoint) {
        try {
            const url = new URL(parts.TableEndpoint);
            return url.protocol === "https:" && !url.username && !url.password;
        } catch { return false; }
    }
    return /^[a-z0-9]{3,24}$/.test(parts.AccountName || "") && parts.DefaultEndpointsProtocol === "https";
}
const rules = [
    ["TENANT_ID", guid], ["CLIENT_ID", guid], ["CLIENT_SECRET", nonempty],
    ["SHAREPOINT_SITE_ID", value => {
        const parts = value.split(",");
        return parts.length === 3 && /^[a-z0-9.-]+\.sharepoint\.com$/i.test(parts[0]) && guid.test(parts[1]) && guid.test(parts[2]);
    }],
    ["SHAREPOINT_NEARMISS_LIST_ID", guid], ["SHAREPOINT_AREAS_LIST_ID", guid],
    ["SHAREPOINT_CONSECUENCIAS_LIST_ID", guid], ["SHAREPOINT_EVIDENCIAS_DRIVE_ID", value => /^[A-Za-z0-9_!-]+$/.test(value)],
    ["SHAREPOINT_EVIDENCIAS_LIST_ID", guid], ["TWILIO_API_KEY", /^SK[0-9a-f]{32}$/i],
    ["TWILIO_API_SECRET", nonempty], ["TWILIO_AUTH_TOKEN", nonempty], ["TWILIO_WEBHOOK_URL", webhookUrl],
    ["SESSION_STORAGE_CONNECTION_STRING", storageConnection],
    ["SESSION_TABLE_NAME", table, "NearMissSessions"], ["SESSION_TTL_MINUTES", integer(1, 1440), "30"],
    ["MESSAGE_IDEMPOTENCY_TABLE_NAME", table, "NearMissProcessedMessages"],
    ["MESSAGE_PROCESSING_TTL_SECONDS", integer(1, 3600), "600"],
    ["SESSION_LOCK_TABLE_NAME", table, "NearMissSessionLocks"], ["SESSION_LOCK_SECONDS", integer(1, 300), "120"],
    ["SESSION_LOCK_RENEW_SECONDS", integer(1, 299), "30"],
    ["EXTERNAL_HTTP_TIMEOUT_MS", integer(1000, 60000), "15000"],
    ["EXTERNAL_HTTP_MAX_ATTEMPTS", integer(1, 5), "3"], ["EXTERNAL_HTTP_RETRY_BASE_MS", integer(100, 5000), "500"],
    ["EVIDENCE_MAX_BYTES", integer(1048576, 20971520), "10485760"]
];
function auditConfig(env = process.env) {
    return rules.map(([name, validator, fallback]) => {
        const missing = env[name] === undefined;
        const value = missing ? fallback : env[name];
        let valid = typeof value === "string" && (validator instanceof RegExp ? validator.test(value) : validator(value));
        if (name === "SESSION_LOCK_RENEW_SECONDS") {
            valid = valid && Number(value) < Number(env.SESSION_LOCK_SECONDS ?? "120");
        }
        return { name, status: valid ? (missing ? "DEFAULT" : "OK") : "ERROR" };
    });
}
if (require.main === module) {
    const results = auditConfig();
    for (const { name, status } of results) console.log(`[${status}] ${name}`);
    process.exitCode = results.some(result => result.status === "ERROR") ? 1 : 0;
}
module.exports = { auditConfig };
