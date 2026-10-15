const { TableClient } = require("@azure/data-tables");
const PARTITION_KEY = "NearMissFolio";
const MAX_ATTEMPTS = 20;
let clientPromise;

function validateYear(year) {
    if (!Number.isInteger(year) || year < 1000 || year > 9999) {
        throw new Error("Invalid folio year: expected a four-digit year");
    }
}

function validateValue(value) {
    if (!Number.isInteger(value) || value < 0 || value > 99999) {
        throw new Error("Invalid folio counter value: expected an integer from 0 to 99999");
    }
}

async function getClient() {
    if (!clientPromise) {
        clientPromise = (async () => {
            const connectionString = process.env.SESSION_STORAGE_CONNECTION_STRING;
            if (typeof connectionString !== "string" || !connectionString.trim()) {
                throw new Error("Missing required environment variable: SESSION_STORAGE_CONNECTION_STRING");
            }
            const tableName = process.env.FOLIO_COUNTER_TABLE_NAME ?? "NearMissFolioCounters";
            if (!/^[A-Za-z][A-Za-z0-9]{2,62}$/.test(tableName)) {
                throw new Error("Invalid FOLIO_COUNTER_TABLE_NAME");
            }
            try {
                const client = TableClient.fromConnectionString(connectionString, tableName,
                    { retryOptions: { maxRetries: 0 } });
                try { await client.createTable(); } catch (error) {
                    if (error?.statusCode !== 409) throw error;
                }
                return client;
            } catch {
                throw new Error("Failed to initialize folio counter storage");
            }
        })();
        clientPromise.catch(() => { clientPromise = undefined; });
    }
    return clientPromise;
}

async function writeCounter(year, value, increment) {
    validateYear(year);
    if (!increment) validateValue(value);
    const client = await getClient();
    const rowKey = String(year);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        let existing;
        try { existing = await client.getEntity(PARTITION_KEY, rowKey); } catch (error) {
            if (error?.statusCode !== 404) throw new Error("Failed to read folio counter");
        }
        if (existing) {
            validateValue(existing.currentValue);
            if (typeof existing.etag !== "string" || !existing.etag || existing.etag === "*") {
                throw new Error("Invalid stored folio counter ETag");
            }
        }
        const next = increment ? (existing?.currentValue ?? 0) + 1 : value;
        if (next > 99999) throw new Error("Folio counter exhausted for year");
        const entity = {
            partitionKey: PARTITION_KEY, rowKey, currentValue: next,
            updatedAt: new Date().toISOString()
        };
        try {
            if (existing) {
                await client.updateEntity(entity, "Merge", { etag: existing.etag });
            } else {
                await client.createEntity(entity);
            }
            return next;
        } catch (error) {
            if ((!existing && error?.statusCode === 409) ||
                (existing && [404, 412].includes(error?.statusCode))) continue;
            throw new Error("Failed to write folio counter");
        }
    }
    throw new Error("Folio counter contention: maximum attempts exceeded");
}

async function getNextFolioNumber(year) {
    return writeCounter(year, undefined, true);
}

// Administrative use only: never called automatically by report submission.
// Stop report intake before lowering/resetting a counter.
async function setFolioCounter(year, value) {
    return writeCounter(year, value, false);
}

module.exports = { getNextFolioNumber, setFolioCounter };
