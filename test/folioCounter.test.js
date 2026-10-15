const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");

function load(file, mocks, env = {}) {
    const filename = path.join(root, file);
    const module = { exports: {} };
    const localRequire = name => {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        if (name.startsWith("@azure/") || name.endsWith("Service")) {
            throw new Error("External dependency must be mocked: " + name);
        }
        return require(name.startsWith(".") ? path.resolve(path.dirname(filename), name) : name);
    };
    vm.runInNewContext(`(function(require,module,exports){${fs.readFileSync(filename, "utf8")}\n})`,
        { process: { env }, Date, Buffer }, { filename })(localRequire, module, module.exports);
    return module.exports;
}

function counterFixture() {
    const rows = new Map();
    const stats = { reads: 0, conflicts: 0, tableName: undefined, forcedConflicts: 0 };
    let version = 0;
    const failure = statusCode => Object.assign(new Error("Simulated storage failure"), { statusCode });
    const client = {
        async createTable() {},
        async getEntity(partitionKey, rowKey) {
            stats.reads++;
            assert.equal(partitionKey, "NearMissFolio");
            const entity = rows.get(rowKey);
            if (!entity) throw failure(404);
            return { ...entity };
        },
        async createEntity(entity) {
            if (rows.has(entity.rowKey)) { stats.conflicts++; throw failure(409); }
            rows.set(entity.rowKey, { ...entity, etag: String(++version) });
        },
        async updateEntity(entity, mode, options) {
            assert.equal(mode, "Merge");
            assert.notEqual(options.etag, "*");
            const old = rows.get(entity.rowKey);
            if (!old) throw failure(404);
            if (stats.forcedConflicts > 0 || old.etag !== options.etag) {
                if (stats.forcedConflicts > 0) stats.forcedConflicts--;
                stats.conflicts++;
                throw failure(412);
            }
            rows.set(entity.rowKey, { ...old, ...entity, etag: String(++version) });
        }
    };
    const service = load("src/services/folioCounterService.js", {
        "@azure/data-tables": { TableClient: { fromConnectionString(connectionString, tableName, options) {
            assert.equal(connectionString, "fake-storage");
            assert.equal(options.retryOptions.maxRetries, 0);
            stats.tableName = tableName;
            return client;
        } } }
    }, { SESSION_STORAGE_CONNECTION_STRING: "fake-storage" });
    return { ...service, rows, stats };
}

const session = () => ({ state: "SUBMIT", eventId: "fake-event", data: { images: [], hasEvidence: false } });
const item = (folio = null) => ({ id: "34", folio, fechaHoraReporte: "2026-06-01T00:00:00Z" });
function submitFixture(mode, { found = null, failPatch = false, counter } = {}) {
    const stats = { counter: 0, creates: 0, patches: [], finds: 0, evidence: 0 };
    const submit = load("src/services/submitReport.js", {
        "./folioCounterService": { getNextFolioNumber: async year => {
            stats.counter++;
            return counter ? counter.getNextFolioNumber(year) : stats.counter;
        } },
        "./sharePointService": {
            findNearMissByEventId: async () => { stats.finds++; return found ? { ...found } : null; },
            createNearMissItem: async (report, options) => {
                stats.creates++;
                assert.equal(options.deferFolio, true);
                return item();
            },
            updateNearMissFolio: async (id, folio) => {
                stats.patches.push({ id, folio });
                if (failPatch) { failPatch = false; throw new Error("Simulated PATCH failure"); }
            }
        },
        "./evidenceService": { persistEvidenceImages: async () => { stats.evidence++; return []; } }
    }, mode === undefined ? {} : { FOLIO_MODE: mode });
    return { submit, stats };
}

test("Folio 1: absent FOLIO_MODE preserves item ID behavior without touching counter", async () => {
    const { submit, stats } = submitFixture();
    const result = await submit(session(), "fake-user");
    assert.equal(result.folio, "SEG-2026-00034");
    assert.equal(stats.counter, 0);
});
test("Folio 2: explicit itemid and item 34 produce SEG-2026-00034", async () => {
    const { submit, stats } = submitFixture("itemid");
    assert.equal((await submit(session(), "fake-user")).folio, "SEG-2026-00034");
    assert.deepEqual(stats.patches, [{ id: "34", folio: "SEG-2026-00034" }]);
    assert.equal(stats.counter, 0);
});
test("Folio 3: counter zero produces 00001 independent of item ID 34", async () => {
    const counter = counterFixture();
    await counter.setFolioCounter(2026, 0);
    const { submit, stats } = submitFixture("counter", { counter });
    assert.equal((await submit(session(), "fake-user")).folio, "SEG-2026-00001");
    assert.equal(stats.counter, 1);
    assert.equal(counter.stats.tableName, "NearMissFolioCounters");
});
test("Folio 4: next report produces 00002", async () => {
    const counter = counterFixture();
    const { submit } = submitFixture("counter", { counter });
    await submit(session(), "fake-user");
    assert.equal((await submit(session(), "fake-user")).folio, "SEG-2026-00002");
});
test("Folio 5: two simultaneous increments return distinct numbers", async () => {
    const counter = counterFixture();
    const numbers = await Promise.all([counter.getNextFolioNumber(2026), counter.getNextFolioNumber(2026)]);
    assert.deepEqual(numbers.sort((a, b) => a - b), [1, 2]);
});
test("Folio 6: ten simultaneous increments return ten unique numbers", async () => {
    const counter = counterFixture();
    const numbers = await Promise.all(Array.from({ length: 10 }, () => counter.getNextFolioNumber(2026)));
    assert.equal(new Set(numbers).size, 10);
    assert.deepEqual(numbers.sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.ok(counter.stats.conflicts > 0);
});
test("Folio 7: known session folio is reused exactly without incrementing", async () => {
    const { submit, stats } = submitFixture("counter");
    const current = session();
    Object.assign(current.data, { sharePointItemId: "34", folio: "SEG-2026-00015", fechaHoraReporte: "2026-06-01T00:00:00Z" });
    assert.equal((await submit(current, "fake-user")).folio, "SEG-2026-00015");
    assert.equal(stats.counter, 0);
    assert.equal(stats.creates, 0);
    assert.equal(stats.finds, 0);
});
test("Folio 8: known SharePoint folio is reused exactly without incrementing or patching", async () => {
    const { submit, stats } = submitFixture("counter", { found: item("SEG-2026-00022") });
    assert.equal((await submit(session(), "fake-user")).folio, "SEG-2026-00022");
    assert.equal(stats.counter, 0);
    assert.equal(stats.creates, 0);
    assert.equal(stats.patches.length, 0);
});
test("Folio 9: administrative reset to zero makes the next number one", async () => {
    const counter = counterFixture();
    await counter.setFolioCounter(2026, 25);
    await counter.setFolioCounter(2026, 0);
    assert.equal(counter.rows.get("2026").currentValue, 0);
    assert.equal(await counter.getNextFolioNumber(2026), 1);
});
test("Folio 10: each year has its own independent counter", async () => {
    const counter = counterFixture();
    await counter.setFolioCounter(2026, 25);
    assert.equal(await counter.getNextFolioNumber(2027), 1);
    assert.equal(counter.rows.get("2026").currentValue, 25);
});
test("Folio 11: 99999 is the final allowed value; overflow fails safely", async () => {
    const counter = counterFixture();
    await counter.setFolioCounter(2026, 99998);
    assert.equal(await counter.getNextFolioNumber(2026), 99999);
    await assert.rejects(counter.getNextFolioNumber(2026), /Folio counter exhausted for year/);
    assert.equal(counter.rows.get("2026").currentValue, 99999);
});
test("Folio 12: ETag 412 rereads and retries with a bounded attempt count", async () => {
    const counter = counterFixture();
    await counter.setFolioCounter(2026, 0);
    const readsBefore = counter.stats.reads;
    counter.stats.forcedConflicts = 1;
    assert.equal(await counter.getNextFolioNumber(2026), 1);
    assert.equal(counter.stats.reads - readsBefore, 2);
    counter.stats.forcedConflicts = 30;
    const beforeExhaustion = counter.stats.reads;
    await assert.rejects(counter.getNextFolioNumber(2026), /maximum attempts exceeded/);
    assert.equal(counter.stats.reads - beforeExhaustion, 20);
});
test("Folio 13: invalid FOLIO_MODE fails before external side effects", async () => {
    const { submit, stats } = submitFixture("invalid");
    await assert.rejects(submit(session(), "fake-user"), /Invalid FOLIO_MODE: expected itemid or counter/);
    assert.equal(stats.counter + stats.creates + stats.finds + stats.patches.length, 0);
});
test("Folio 14: default and itemid preserve recovery, mismatch and PATCH failure semantics", async () => {
    for (const mode of [undefined, "itemid"]) {
        const recovered = submitFixture(mode, { found: item("SEG-2026-00034") });
        const current = session();
        assert.equal((await recovered.submit(current, "fake-user")).folio, "SEG-2026-00034");
        assert.equal(current.state, "COMPLETE");
        assert.equal(recovered.stats.patches.length, 0);
        const known = session();
        Object.assign(known.data, { sharePointItemId: "34", folio: "SEG-2026-00034", fechaHoraReporte: "2026-06-01T00:00:00Z" });
        const reuse = submitFixture(mode);
        await reuse.submit(known, "fake-user");
        assert.equal(reuse.stats.patches.length, 0);
        const mismatch = submitFixture(mode, { found: item("SEG-2026-00022") });
        await assert.rejects(mismatch.submit(session(), "fake-user"), /folio mismatch/);
        const failure = submitFixture(mode, { failPatch: true });
        const partial = session();
        await assert.rejects(failure.submit(partial, "fake-user"), /PATCH failure/);
        assert.equal(partial.data.sharePointItemId, "34");
        assert.equal(partial.data.folio, undefined);
        assert.equal(failure.stats.counter, 0);
    }
});
test("Counter retry retains allocated folio across a failed PATCH and session serialization", async () => {
    const { submit, stats } = submitFixture("counter", { failPatch: true });
    const current = session();
    await assert.rejects(submit(current, "fake-user"), /PATCH failure/);
    assert.equal(current.data.folio, "SEG-2026-00001");
    assert.equal(current.state, "SUBMIT");
    const saved = JSON.parse(JSON.stringify(current));
    assert.equal((await submit(saved, "fake-user")).folio, "SEG-2026-00001");
    assert.equal(stats.counter, 1);
    assert.equal(stats.creates, 1);
    assert.deepEqual(stats.patches.map(p => p.folio), ["SEG-2026-00001", "SEG-2026-00001"]);
});
test("Counter validates year and administrative value before storage access", async () => {
    const counter = counterFixture();
    for (const year of [999, 10000, "2026", 2026.5, NaN]) {
        await assert.rejects(counter.getNextFolioNumber(year), /Invalid folio year/);
    }
    for (const value of [-1, 100000, 1.5, "0", NaN]) {
        await assert.rejects(counter.setFolioCounter(2026, value), /Invalid folio counter value/);
    }
    assert.equal(counter.stats.reads, 0);
});
