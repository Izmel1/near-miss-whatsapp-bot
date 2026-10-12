const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");

// Isolated CommonJS loader: explicit environment and mocked external imports.
// Unmocked SDK imports and network requests fail closed.
function load(file, mocks = {}, env = {}, globals = {}) {
    const filename = path.join(root, file);
    const module = { exports: {} };
    const localRequire = name => {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        if (name.startsWith("@azure/") || name === "./httpRequestService" ||
            name === "./twilioMediaService" || name === "./sharePointEvidenceService" || name === "./sharePointService") {
            throw new Error("External dependency must be mocked: " + name);
        }
        return require(name.startsWith(".") ? path.resolve(path.dirname(filename), name) : name);
    };
    vm.runInNewContext(`(function(require,module,exports){${fs.readFileSync(filename, "utf8")}\n})`, {
        process: { env }, Buffer, URL, URLSearchParams, Date, AbortController,
        setTimeout, clearTimeout, fetch: async () => { throw new Error("Network forbidden in tests"); },
        ...globals
    }, { filename })(localRequire, module, module.exports);
    return module.exports;
}
function storage() {
    const rows = new Map();
    let version = 0;
    const key = (p, r) => `${p}/${r}`;
    const failure = statusCode => Object.assign(new Error("Simulated storage failure"), { statusCode });
    const client = {
        async createTable() {},
        async createEntity(entity) {
            const k = key(entity.partitionKey, entity.rowKey);
            if (rows.has(k)) throw failure(409);
            rows.set(k, { ...entity, etag: String(++version) });
        },
        async getEntity(p, r) {
            const value = rows.get(key(p, r));
            if (!value) throw failure(404);
            return { ...value };
        },
        async upsertEntity(entity) { rows.set(key(entity.partitionKey, entity.rowKey), { ...entity, etag: String(++version) }); },
        async updateEntity(entity, mode, options) {
            const k = key(entity.partitionKey, entity.rowKey);
            const old = rows.get(k);
            if (!old) throw failure(404);
            if (options.etag !== old.etag) throw failure(412);
            rows.set(k, { ...(mode === "Merge" ? old : {}), ...entity, etag: String(++version) });
        },
        async deleteEntity(p, r, options) {
            const old = rows.get(key(p, r));
            if (!old) throw failure(404);
            if (options && options.etag !== old.etag) throw failure(412);
            rows.delete(key(p, r));
        }
    };
    return { rows, mocks: { "@azure/data-tables": { TableClient: { fromConnectionString: () => client } } } };
}
const context = () => ({ records: [], log(value) { this.records.push(value); }, error(value) { this.records.push(value); } });
const jpeg = Buffer.from([255, 216, 255, 0, 255, 217]);
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
const receipts = require("../src/services/sessionMessageReceiptService");
const evidence = load("src/services/evidenceValidationService.js");
const fakeStorageEnv = { SESSION_STORAGE_CONNECTION_STRING: "test-only-not-a-connection" };

test("1. Receipt uses SHA256, prunes old/invalid entries and retains at most 20", () => {
    assert.equal(receipts.hashMessageId(" test-message "), crypto.createHash("sha256").update("test-message").digest("hex"));
    const session = { messageReceipts: [{ messageKey: receipts.hashMessageId("old"), reply: null,
        appliedAt: new Date(Date.now() - 25 * 3600000).toISOString() }, { messageKey: "raw-id", reply: "bad" }] };
    for (let i = 0; i < 25; i++) receipts.recordMessageReceipt(session, `message-${i}`, "reply");
    assert.equal(session.messageReceipts.length, 20);
    assert.equal(receipts.findMessageReceipt(session, "old"), null);
    assert.equal(receipts.findMessageReceipt(session, "message-24").reply, "reply");
    assert.ok(session.messageReceipts.every(r => /^[a-f0-9]{64}$/.test(r.messageKey)));
});
test("2. JPEG signature and MIME accepted", () => {
    const result = evidence.validateEvidenceBuffer(jpeg, "image/jpg", "image/jpeg; charset=binary");
    assert.equal(result.mimeType, "image/jpeg"); assert.equal(result.extension, ".jpg");
});
test("3. PNG signature and MIME accepted", () => {
    assert.equal(evidence.validateEvidenceBuffer(png, "image/png", "image/png").extension, ".png");
});
test("4. MIME spoof and truncated images rejected", () => {
    assert.throws(() => evidence.validateEvidenceBuffer(jpeg, "image/png", "image/png"), /does not match/);
    assert.throws(() => evidence.validateEvidenceBuffer(Buffer.from("HTML"), "image/jpeg"), /signature/);
    assert.throws(() => evidence.validateEvidenceBuffer(jpeg.subarray(0, 5), "image/jpeg"), /Truncated/);
});
test("5. Oversized buffer and streamed evidence rejected", async () => {
    const validator = load("src/services/evidenceValidationService.js", {}, { EVIDENCE_MAX_BYTES: "1048576" });
    assert.throws(() => validator.validateEvidenceBuffer(Buffer.alloc(1048577), "image/jpeg"), /maximum/);
    let cancelled = false;
    const response = { headers: { get: () => null }, body: { getReader: () => ({
        read: async () => ({ done: false, value: new Uint8Array(11) }),
        cancel: async () => { cancelled = true; }, releaseLock() {}
    }) } };
    await assert.rejects(validator.readEvidenceBuffer(response, new AbortController().signal, 10), /maximum/);
    assert.equal(cancelled, true);
});
test("6. Duplicate COMPLETED claim returns persisted reply (409 without code)", async () => {
    const store = storage();
    const service = load("src/services/messageIdempotencyService.js", store.mocks, fakeStorageEnv);
    const first = await service.claimMessage("same-message");
    await service.completeMessage("same-message", first.token, "same reply");
    const second = await service.claimMessage("same-message");
    assert.equal(second.status, "COMPLETED"); assert.equal(second.reply, "same reply");
    assert.equal(store.rows.size, 1);
});
test("7. Lost claim ownership cannot complete or release current owner's entity", async () => {
    const store = storage();
    const service = load("src/services/messageIdempotencyService.js", store.mocks, fakeStorageEnv);
    await service.claimMessage("message");
    await assert.rejects(service.completeMessage("message", "old-token", "reply"), /ownership lost/);
    await service.releaseMessage("message", "old-token");
    assert.equal(store.rows.size, 1);
});
test("8. Old session lock token cannot renew or delete a reclaimed lock", async () => {
    const store = storage();
    const service = load("src/services/sessionLockService.js", store.mocks, fakeStorageEnv);
    const old = await service.acquireSessionLock("test-user");
    for (const row of store.rows.values()) row.expiresAt = new Date(0).toISOString();
    const current = await service.acquireSessionLock("test-user");
    assert.notEqual(current.token, old.token);
    await service.releaseSessionLock("test-user", old.token);
    await assert.rejects(service.renewSessionLock("test-user", old.token), /ownership lost/);
    assert.equal(store.rows.size, 1);
    await service.releaseSessionLock("test-user", current.token);
    assert.equal(store.rows.size, 0);
});
async function resetSession(state, expired) {
    const store = storage();
    const service = load("src/session/sessionStore.js", store.mocks, fakeStorageEnv);
    const old = await service.getOrCreateSession("test-user");
    receipts.recordMessageReceipt(old, "recent-message", "reply");
    old.state = state; old.data = { description: "test-only" };
    if (expired) old.updatedAt = new Date(Date.now() - 31 * 60000);
    await service.saveSession("test-user", old);
    const fresh = await service.getOrCreateSession("test-user");
    assert.equal(fresh.state, "START"); assert.notEqual(fresh.eventId, old.eventId);
    assert.equal(Object.keys(fresh.data).length, 0);
    assert.equal(receipts.findMessageReceipt(fresh, "recent-message").reply, "reply");
}
test("9. Expired session starts a new report preserving recent receipts", () => resetSession("AREA", true));
test("10. COMPLETE starts a new report preserving receipts", () => resetSession("COMPLETE", false));
test("11. External GET retries 503 and returns 200", async () => {
    let calls = 0;
    const http = load("src/services/httpRequestService.js", {}, { EXTERNAL_HTTP_RETRY_BASE_MS: "100" }, {
        fetch: async () => new Response("", { status: ++calls === 1 ? 503 : 200 })
    });
    assert.equal((await http.requestWithRetry("https://example.invalid/test")).status, 200);
    assert.equal(calls, 2);
});
test("12. createNearMissItem POST is not retried after HTTP 503", async () => {
    let creates = 0;
    const http = load("src/services/httpRequestService.js", {}, {}, { fetch: async (url, options) => {
        if (url.includes("oauth2")) return Response.json({ access_token: "fake-token" });
        if (options.method === "POST") { creates++; return Response.json({ error: { code: "unavailable", message: "simulated" } }, { status: 503 }); }
        return Response.json({ value: [{ id: "1", fields: { Title: "Test catalog", Activo: true } }] });
    } });
    const graph = load("src/services/sharePointService.js", { "./httpRequestService": http }, {
        TENANT_ID: "test", CLIENT_ID: "test", CLIENT_SECRET: "fake-secret", SHAREPOINT_SITE_ID: "test",
        SHAREPOINT_NEARMISS_LIST_ID: "test", SHAREPOINT_AREAS_LIST_ID: "test", SHAREPOINT_CONSECUENCIAS_LIST_ID: "test"
    });
    await assert.rejects(graph.createNearMissItem({ eventId: "test-event", fechaHoraReporte: "2026-01-01T00:00:00Z",
        numeroEmpleado: "test", whatsappUserId: "test", area: "Test catalog", ubicacion: "test", descripcion: "test",
        consequences: ["Test catalog"], prevention: "test", hasEvidence: false }, { deferFolio: true }), /HTTP 503/);
    assert.equal(creates, 1);
});
const signatureEnv = { TWILIO_AUTH_TOKEN: "fake-test-auth-token", TWILIO_WEBHOOK_URL: "https://example.invalid/api/webhook" };
const signatureParams = { Body: "test", MessageSid: "test-message", From: "test-user" };
const twilio = require("twilio");
const validation = load("src/services/twilioWebhookValidationService.js", {}, signatureEnv);
test("13. Valid Twilio signature accepted without network", () => {
    const signature = twilio.getExpectedTwilioSignature(signatureEnv.TWILIO_AUTH_TOKEN, signatureEnv.TWILIO_WEBHOOK_URL, signatureParams);
    assert.equal(validation.validateTwilioWebhook({ signature, params: signatureParams }), true);
});
test("14. Invalid or tampered Twilio signature rejected", () => {
    assert.equal(validation.validateTwilioWebhook({ signature: "invalid", params: signatureParams }), false);
    const signature = twilio.getExpectedTwilioSignature(signatureEnv.TWILIO_AUTH_TOKEN, signatureEnv.TWILIO_WEBHOOK_URL, signatureParams);
    assert.equal(validation.validateTwilioWebhook({ signature, params: { ...signatureParams, Body: "tampered" } }), false);
});
const reportSession = () => ({ state: "SUBMIT", eventId: "test-event", data: { images: [], hasEvidence: false } });
test("15. EventID recovery avoids a second create and reaches COMPLETE", async () => {
    let creates = 0;
    const submit = load("src/services/submitReport.js", {
        "./sharePointService": { findNearMissByEventId: async () => ({ id: "10", folio: "SEG-2026-00010", fechaHoraReporte: "2026-01-01T00:00:00Z" }),
            createNearMissItem: async () => { creates++; throw new Error("Must not create"); }, updateNearMissFolio: async () => assert.fail("Must not patch") },
        "./evidenceService": { persistEvidenceImages: async () => assert.fail("No evidence expected") }
    });
    const session = reportSession();
    const result = await submit(session, "test-user", context());
    assert.equal(creates, 0); assert.equal(session.state, "COMPLETE"); assert.equal(result.folio, "SEG-2026-00010");
});
test("16. Recovered folio mismatch fails before creating or uploading", async () => {
    const submit = load("src/services/submitReport.js", {
        "./sharePointService": { findNearMissByEventId: async () => ({ id: "10", folio: "SEG-2026-99999", fechaHoraReporte: "2026-01-01T00:00:00Z" }),
            createNearMissItem: async () => assert.fail("Must not create"), updateNearMissFolio: async () => assert.fail("Must not patch") },
        "./evidenceService": { persistEvidenceImages: async () => assert.fail("Must not upload") }
    });
    await assert.rejects(submit(reportSession(), "test-user", context()), /folio mismatch/);
});
test("17. Repeated evidence persistence uses the same deterministic filename", async () => {
    const names = [];
    const service = load("src/services/evidenceService.js", {
        "./twilioMediaService": { downloadTwilioMedia: async () => ({ buffer: jpeg, mimeType: "image/jpeg", size: jpeg.length }) },
        "./sharePointEvidenceService": { uploadEvidenceFile: async ({ fileName }) => { names.push(fileName); return { id: "same-item" }; },
            updateEvidenceMetadata: async () => {} }
    });
    const input = { images: [{ messageId: "test-message" }], eventId: "test-event", folio: "SEG-2026-00010", nearMissItemId: "10" };
    await service.persistEvidenceImages(input); await service.persistEvidenceImages(input);
    assert.deepEqual(names, ["SEG-2026-00010_01.jpg", "SEG-2026-00010_01.jpg"]);
});
test("18. safeLogger drops arbitrary fields, objects, messages, stacks and unknown error codes", () => {
    const { safeLog, safeError } = require("../src/utils/safeLogger");
    const ctx = context();
    safeLog(ctx, "State transition", { fromState: "AREA", toState: "DESCRIPTION", userId: "SECRET", Body: "SECRET",
        session: { data: "SECRET" }, operation: "SECRET", evidenceCount: { secret: true }, state: "SECRET" });
    assert.deepEqual(ctx.records[0], { event: "State transition", fromState: "AREA", toState: "DESCRIPTION" });
    safeError(ctx, "Operation failed", { message: "SECRET", stack: "SECRET", code: "SECRET", statusCode: 503, headers: "SECRET" });
    assert.deepEqual(ctx.records[1], { event: "Operation failed", status: 503 });
    assert.throws(() => safeLog(ctx, "SECRET", {}), /Invalid technical/);
    assert.ok(!JSON.stringify(ctx.records).includes("SECRET"));
});
test("19. safeError retains only known technical error code and HTTP status", () => {
    const { safeError } = require("../src/utils/safeLogger");
    const ctx = context();
    safeError(ctx, "Operation failed", { code: "EXTERNAL_HTTP_TIMEOUT", status: 504, message: "private" }, { operation: "http", attempt: 2 });
    assert.deepEqual(ctx.records[0], { event: "Operation failed", operation: "http", attempt: 2, errorCode: "EXTERNAL_HTTP_TIMEOUT", status: 504 });
});
const guid = "11111111-1111-4111-8111-111111111111";
const fakeConfig = {
    TENANT_ID: guid, CLIENT_ID: guid, CLIENT_SECRET: "fake-secret",
    SHAREPOINT_SITE_ID: `test.sharepoint.com,${guid},${guid}`,
    SHAREPOINT_NEARMISS_LIST_ID: guid, SHAREPOINT_AREAS_LIST_ID: guid, SHAREPOINT_CONSECUENCIAS_LIST_ID: guid,
    SHAREPOINT_EVIDENCIAS_DRIVE_ID: "b!fake-drive", SHAREPOINT_EVIDENCIAS_LIST_ID: guid,
    TWILIO_API_KEY: "SK" + "0".repeat(32), TWILIO_API_SECRET: "fake-secret", ...signatureEnv,
    SESSION_STORAGE_CONNECTION_STRING: "DefaultEndpointsProtocol=https;AccountName=fakestorage;AccountKey=ZmFrZQ==;EndpointSuffix=core.windows.net"
};
test("20. Configuration audit accepts fictitious settings and documented defaults", () => {
    const { auditConfig } = require("../scripts/check-config");
    const results = auditConfig(fakeConfig);
    assert.equal(results.length, 25); assert.ok(results.every(r => r.status !== "ERROR"));
    assert.equal(results.find(r => r.name === "SESSION_TTL_MINUTES").status, "DEFAULT");
    assert.ok(!JSON.stringify(results).includes("fake-secret"));
});
test("21. Configuration audit rejects missing secrets, invalid ranges and renewal >= TTL", () => {
    const { auditConfig } = require("../scripts/check-config");
    const results = auditConfig({ ...fakeConfig, CLIENT_SECRET: "", EXTERNAL_HTTP_MAX_ATTEMPTS: "0", SESSION_LOCK_SECONDS: "30" });
    for (const name of ["CLIENT_SECRET", "EXTERNAL_HTTP_MAX_ATTEMPTS", "SESSION_LOCK_RENEW_SECONDS"])
        assert.equal(results.find(r => r.name === name).status, "ERROR");
    assert.ok(auditConfig({}).some(r => r.status === "ERROR"));
});
test("22. Config CLI returns 0/1 without printing fictitious credentials", () => {
    const command = path.join(root, "scripts/check-config.js");
    const valid = spawnSync(process.execPath, [command], { env: fakeConfig, encoding: "utf8" });
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /\[DEFAULT\] SESSION_TTL_MINUTES/);
    assert.ok(!valid.stdout.includes("fake-secret"));
    assert.ok(!valid.stdout.includes(fakeConfig.SESSION_STORAGE_CONNECTION_STRING));
    const invalid = spawnSync(process.execPath, [command], { env: {}, encoding: "utf8" });
    assert.equal(invalid.status, 1, invalid.stderr);
    assert.match(invalid.stdout, /\[ERROR\] CLIENT_SECRET/);
});
