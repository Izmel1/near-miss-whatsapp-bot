const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_DELAY_MS = 10000;

function setting(name, fallback, min, max) {
    const raw = process.env[name];
    if (raw === undefined) return fallback;
    if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) {
        throw new Error(`Invalid ${name}: expected an integer from ${min} to ${max}`);
    }
    return Number(raw);
}

function retryDelay(response, base, attempt) {
    const value = response?.headers.get("retry-after");
    if (value) {
        const seconds = /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : NaN;
        const date = Date.parse(value);
        const delay = Number.isFinite(seconds) ? seconds * 1000 : date - Date.now();
        if (Number.isFinite(delay)) return Math.min(MAX_DELAY_MS, Math.max(0, delay));
    }
    return Math.min(MAX_DELAY_MS, base * 2 ** (attempt - 1));
}

async function requestWithRetry(url, options = {}, { retryable, consume } = {}) {
    const timeout = setting("EXTERNAL_HTTP_TIMEOUT_MS", 15000, 1000, 60000);
    const configuredAttempts = setting("EXTERNAL_HTTP_MAX_ATTEMPTS", 3, 1, 5);
    const base = setting("EXTERNAL_HTTP_RETRY_BASE_MS", 500, 100, 5000);
    const method = (options.method || "GET").toUpperCase();
    const allowRetry = retryable === undefined ? ["GET", "HEAD"].includes(method) : retryable === true;
    const attempts = allowRetry ? configuredAttempts : 1;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        let response;
        let error;
        let consumed;
        try {
            response = await fetch(url, { ...options, signal: controller.signal });
            if (consume && !TRANSIENT_STATUSES.has(response.status)) {
                consumed = await consume(response, controller.signal);
            }
            if (controller.signal.aborted) throw new Error("Aborted");
        } catch (caught) {
            if (caught?.code === "EVIDENCE_VALIDATION") throw caught;
            error = new Error(controller.signal.aborted
                ? "External request timed out"
                : "External request failed: network error");
            error.code = controller.signal.aborted ? "EXTERNAL_HTTP_TIMEOUT" : "EXTERNAL_HTTP_NETWORK";
        } finally {
            clearTimeout(timer);
        }
        if (!error && (!TRANSIENT_STATUSES.has(response.status) || attempt === attempts)) {
            return consume && !TRANSIENT_STATUSES.has(response.status) ? consumed : response;
        }
        if (attempt === attempts) throw error;
        const delay = retryDelay(response, base, attempt);
        // Descartar el body del intento fallido antes de reutilizar la conexión.
        try {
            await response?.body?.cancel();
        } catch {
            // La respuesta transitoria ya se está descartando.
        }
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

function requestWithRetryAndConsume(url, options, consume, policy = {}) {
    return requestWithRetry(url, options, { ...policy, consume });
}

module.exports = { requestWithRetry, requestWithRetryAndConsume };
