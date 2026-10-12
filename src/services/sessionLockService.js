const crypto = require("crypto");
const { TableClient } = require("@azure/data-tables");
const PARTITION_KEY = "NearMissSessionLock";
let clientPromise;

function sessionKey(userId) {
    if (typeof userId !== "string" || !userId.trim()) throw new Error("Invalid session lock user ID");
    return crypto.createHash("sha256").update(userId.trim()).digest("hex");
}

function lockMilliseconds() {
    const value = process.env.SESSION_LOCK_SECONDS;
    if (value === undefined) return 120000;
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 300) {
        throw new Error("Invalid SESSION_LOCK_SECONDS: expected an integer from 1 to 300");
    }
    return Number(value) * 1000;
}

async function getClient() {
    if (!clientPromise) {
        clientPromise = (async () => {
            const connectionString = process.env.SESSION_STORAGE_CONNECTION_STRING;
            if (typeof connectionString !== "string" || !connectionString.trim()) {
                throw new Error("Missing required environment variable: SESSION_STORAGE_CONNECTION_STRING");
            }
            try {
                const client = TableClient.fromConnectionString(connectionString,
                    process.env.SESSION_LOCK_TABLE_NAME || "NearMissSessionLocks",
                    { retryOptions: { maxRetries: 0 } });
                try {
                    await client.createTable();
                } catch (error) {
                    if (error.statusCode !== 409 || error.code !== "TableAlreadyExists") throw error;
                }
                return client;
            } catch {
                throw new Error("Failed to initialize session lock storage");
            }
        })();
        clientPromise.catch(() => { clientPromise = undefined; });
    }
    return clientPromise;
}

async function acquireSessionLock(userId) {
    const rowKey = sessionKey(userId);
    const ttl = lockMilliseconds();
    const client = await getClient();
    const now = Date.now();
    const token = crypto.randomUUID();
    const entity = {
        partitionKey: PARTITION_KEY, rowKey, lockToken: token,
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + ttl).toISOString()
    };
    try {
        await client.createEntity(entity);
        return { status: "ACQUIRED", token };
    } catch (error) {
        if (error?.statusCode !== 409) throw new Error("Failed to acquire session lock");
    }
    let existing;
    try {
        existing = await client.getEntity(PARTITION_KEY, rowKey);
    } catch (error) {
        if (error?.statusCode === 404) return { status: "BUSY" };
        throw new Error("Failed to read session lock");
    }
    const expiry = Date.parse(existing.expiresAt);
    if (!Number.isFinite(expiry) || !existing.etag) throw new Error("Invalid stored session lock");
    if (expiry > Date.now()) return { status: "BUSY" };
    try {
        await client.updateEntity(entity, "Replace", { etag: existing.etag });
        return { status: "ACQUIRED", token };
    } catch (error) {
        if (error?.statusCode === 412 || error?.statusCode === 404) return { status: "BUSY" };
        throw new Error("Failed to reclaim expired session lock");
    }
}

async function releaseSessionLock(userId, token) {
    const rowKey = sessionKey(userId);
    if (typeof token !== "string" || !token.trim()) throw new Error("Invalid session lock token");
    const client = await getClient();
    try {
        const entity = await client.getEntity(PARTITION_KEY, rowKey);
        if (entity.lockToken !== token) return;
        if (!entity.etag) throw new Error("Invalid ETag");
        await client.deleteEntity(PARTITION_KEY, rowKey, { etag: entity.etag });
    } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 412) return;
        throw new Error("Failed to release session lock");
    }
}

async function renewSessionLock(userId, token) {
    const rowKey = sessionKey(userId);
    if (typeof token !== "string" || !token.trim()) throw new Error("Invalid session lock token");
    const ttl = lockMilliseconds();
    const client = await getClient();
    let entity;
    try {
        entity = await client.getEntity(PARTITION_KEY, rowKey);
    } catch (error) {
        if (error?.statusCode === 404) throw new Error("Session lock ownership lost");
        throw new Error("Failed to read session lock for renewal");
    }
    if (entity.lockToken !== token) throw new Error("Session lock ownership lost");
    if (!entity.etag) throw new Error("Invalid stored session lock ETag");
    const now = Date.now();
    try {
        await client.updateEntity({
            partitionKey: PARTITION_KEY, rowKey,
            updatedAt: new Date(now).toISOString(),
            expiresAt: new Date(now + ttl).toISOString()
        }, "Merge", { etag: entity.etag });
    } catch (error) {
        if (error?.statusCode === 412 || error?.statusCode === 404) {
            throw new Error("Session lock ownership lost");
        }
        throw new Error("Failed to renew session lock");
    }
}

function startSessionLockHeartbeat(userId, token) {
    sessionKey(userId);
    if (typeof token !== "string" || !token.trim()) throw new Error("Invalid session lock token");
    const ttl = lockMilliseconds();
    const raw = process.env.SESSION_LOCK_RENEW_SECONDS;
    const seconds = raw === undefined ? 30 : Number(raw);
    if ((raw !== undefined && !/^\d+$/.test(raw)) || !Number.isInteger(seconds) ||
        seconds < 1 || seconds > 299 || seconds * 1000 >= ttl) {
        throw new Error("Invalid SESSION_LOCK_RENEW_SECONDS: expected 1 to 299 and less than SESSION_LOCK_SECONDS");
    }
    let stopped = false;
    let failure;
    let timer;
    let wake;
    const running = (async () => {
        try {
            while (!stopped) {
                await new Promise(resolve => {
                    wake = resolve;
                    timer = setTimeout(resolve, seconds * 1000);
                });
                clearTimeout(timer);
                timer = undefined;
                wake = undefined;
                if (stopped) break;
                await renewSessionLock(userId, token);
            }
        } catch (error) {
            failure = error;
        }
    })();
    return {
        throwIfFailed() {
            if (failure) throw failure;
        },
        async stop() {
            stopped = true;
            if (timer !== undefined) clearTimeout(timer);
            if (wake) wake();
            await running;
        }
    };
}

module.exports = { acquireSessionLock, releaseSessionLock, renewSessionLock, startSessionLockHeartbeat };
