function invalid(message) {
    const error = new Error(message);
    error.code = "EVIDENCE_VALIDATION";
    return error;
}

function maxEvidenceBytes() {
    const raw = process.env.EVIDENCE_MAX_BYTES;
    if (raw === undefined) return 10485760;
    if (!/^\d+$/.test(raw) || Number(raw) < 1048576 || Number(raw) > 20971520) {
        throw invalid("Invalid EVIDENCE_MAX_BYTES: expected 1048576 to 20971520");
    }
    return Number(raw);
}

function normalizeMime(value) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") throw invalid("Unsupported evidence MIME type");
    const mime = value.split(";")[0].trim().toLowerCase();
    if (mime === "image/jpg") return "image/jpeg";
    if (!["image/jpeg", "image/png"].includes(mime)) throw invalid("Unsupported evidence MIME type");
    return mime;
}

function validateEvidenceBuffer(buffer, declaredMime, httpMime) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw invalid("Empty evidence response");
    if (buffer.length > maxEvidenceBytes()) throw invalid("Evidence exceeds maximum allowed size");
    let mimeType;
    let extension;
    if (buffer.length >= 5 && buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) {
        if (!buffer.subarray(-2).equals(Buffer.from([255, 217]))) throw invalid("Truncated JPEG evidence");
        mimeType = "image/jpeg";
        extension = ".jpg";
    } else if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        const iend = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
        if (buffer.length < 20 || !buffer.subarray(-12).equals(iend)) throw invalid("Truncated PNG evidence");
        mimeType = "image/png";
        extension = ".png";
    } else {
        throw invalid("Unsupported evidence file signature");
    }
    const declared = normalizeMime(declaredMime);
    const http = normalizeMime(httpMime);
    if (!declared && !http) throw invalid("Missing evidence MIME type");
    if ((declared && declared !== mimeType) || (http && http !== mimeType)) {
        throw invalid("Evidence MIME type does not match file content");
    }
    return { mimeType, extension };
}

async function readEvidenceBuffer(response, signal, limit) {
    const length = response.headers.get("content-length");
    if (length && /^\d+$/.test(length) && Number(length) > limit) {
        void response.body?.cancel().catch(() => {});
        throw invalid("Evidence exceeds maximum allowed size");
    }
    if (!response.body) throw invalid("Empty evidence response");
    const reader = response.body.getReader();
    const abort = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener("abort", abort, { once: true });
    const chunks = [];
    let total = 0;
    try {
        if (signal.aborted) throw new Error("Aborted");
        while (true) {
            const { done, value } = await reader.read();
            if (signal.aborted) throw new Error("Aborted");
            if (done) break;
            total += value.byteLength;
            if (total > limit) {
                abort();
                throw invalid("Evidence exceeds maximum allowed size");
            }
            chunks.push(Buffer.from(value));
        }
        if (!total) throw invalid("Empty evidence response");
        return Buffer.concat(chunks, total);
    } finally {
        signal.removeEventListener("abort", abort);
        reader.releaseLock();
    }
}

module.exports = { maxEvidenceBytes, normalizeMime, validateEvidenceBuffer, readEvidenceBuffer };
