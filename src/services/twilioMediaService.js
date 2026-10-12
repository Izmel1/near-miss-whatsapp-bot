const { maxEvidenceBytes, normalizeMime, validateEvidenceBuffer, readEvidenceBuffer } = require("./evidenceValidationService");
const { requestWithRetryAndConsume } = require("./httpRequestService");
const INITIAL_HOST = "api.twilio.com";
const REDIRECT_HOST = "mms.twiliocdn.com";
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

function requireEnvironment(name) {
    const value = process.env[name];
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function validateUrl(value, base, allowedHost = INITIAL_HOST) {
    let url;
    try {
        url = base ? new URL(value, base) : new URL(value);
    } catch {
        throw new Error("Invalid Twilio media URL");
    }
    if (url.protocol !== "https:" || url.hostname !== allowedHost ||
        url.username || url.password || (url.port && url.port !== "443")) {
        throw new Error("Invalid Twilio media URL");
    }
    return url;
}

async function downloadTwilioMedia(media) {
    if (!media || typeof media !== "object" ||
        typeof media.mediaUrl !== "string" || !media.mediaUrl.trim()) {
        throw new Error("Invalid Twilio media URL");
    }
    let url = validateUrl(media.mediaUrl.trim());
    const limit = maxEvidenceBytes();
    normalizeMime(media.mimeType);
    const apiKey = requireEnvironment("TWILIO_API_KEY");
    const apiSecret = requireEnvironment("TWILIO_API_SECRET");
    const authorization = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;

    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
        let response;
        try {
            response = await requestWithRetryAndConsume(url.href, {
                method: "GET",
                redirect: "manual",
                headers: url.hostname === INITIAL_HOST
                    ? { Authorization: authorization }
                    : {}
            }, async (response, signal) => {
                if (response.status < 200 || response.status >= 300) return response;
                const httpMime = response.headers.get("content-type");
                normalizeMime(httpMime);
                const buffer = await readEvidenceBuffer(response, signal, limit);
                const detected = validateEvidenceBuffer(buffer, media.mimeType, httpMime);
                return { buffer, mimeType: detected.mimeType, size: buffer.length };
            });
        } catch (error) {
            if (error?.code === "EVIDENCE_VALIDATION" || error?.code === "EXTERNAL_HTTP_TIMEOUT" || error?.message?.startsWith("Invalid EXTERNAL_HTTP_")) throw error;
            throw new Error("Failed to download Twilio media: network error");
        }
        if (REDIRECT_STATUSES.has(response.status)) {
            const location = response.headers.get("location");
            if (!location) {
                throw new Error("Invalid Twilio media redirect");
            }
            const nextUrl = validateUrl(location, url, REDIRECT_HOST);
            if (redirects === MAX_REDIRECTS) {
                throw new Error("Failed to download Twilio media: too many redirects");
            }
            url = nextUrl;
            continue;
        }
        if (response.buffer) return response;
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Failed to download Twilio media: HTTP ${response.status}`);
        }
        return response;
    }
}

module.exports = { downloadTwilioMedia };
