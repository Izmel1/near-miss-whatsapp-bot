const crypto = require("crypto");
const { pruneMessageReceipts } = require("../services/sessionMessageReceiptService");

const { TableClient } = require("@azure/data-tables");
const PARTITION_KEY = "NearMissSession";
let clientPromise;

function sessionKey(userId) {
    if (typeof userId !== "string" || !userId.trim()) {
        throw new Error("Invalid session user ID");
    }
    return crypto.createHash("sha256").update(userId.trim()).digest("hex");
}

async function getClient() {
    if (!clientPromise) {
        clientPromise = (async () => {
            const connectionString = process.env.SESSION_STORAGE_CONNECTION_STRING;
            if (typeof connectionString !== "string" || !connectionString.trim()) {
                throw new Error("Missing required environment variable: SESSION_STORAGE_CONNECTION_STRING");
            }
            try {
                const client = TableClient.fromConnectionString(
                    connectionString,
                    process.env.SESSION_TABLE_NAME || "NearMissSessions",
                    { retryOptions: { maxRetries: 0 } }
                );
                try {
                    await client.createTable();
                } catch (error) {
                    if (error.statusCode !== 409 || error.code !== "TableAlreadyExists") throw error;
                }
                return client;
            } catch {
                throw new Error("Failed to initialize session Table Storage");
            }
        })();
        clientPromise.catch(() => { clientPromise = undefined; });
    }
    return clientPromise;
}

function validateSession(session) {
    if (!session || typeof session.state !== "string" || !session.state.trim() ||
        typeof session.eventId !== "string" || !session.eventId.trim() ||
        !session.data || typeof session.data !== "object" || Array.isArray(session.data) ||
        !(session.createdAt instanceof Date) || Number.isNaN(session.createdAt.getTime()) ||
        !(session.updatedAt instanceof Date) || Number.isNaN(session.updatedAt.getTime())) {
        throw new Error("Invalid stored session");
    }
}

async function getSession(userId) {
    const rowKey = sessionKey(userId);
    const client = await getClient();
    let entity;
    try {
        entity = await client.getEntity(PARTITION_KEY, rowKey);
    } catch (error) {
        if (error.statusCode === 404 && (!error.code || error.code === "ResourceNotFound")) return null;
        throw new Error("Failed to read session from Table Storage");
    }
    try {
        const session = JSON.parse(entity.sessionJson);
        if (!session || typeof session.createdAt !== "string" || typeof session.updatedAt !== "string") {
            throw new Error("Invalid dates");
        }
        session.createdAt = new Date(session.createdAt);
        session.updatedAt = new Date(session.updatedAt);
        validateSession(session);
        return session;
    } catch {
        throw new Error("Invalid stored session: corrupt or invalid session JSON");
    }
}

async function saveSession(userId, session) {
    const rowKey = sessionKey(userId);
    validateSession(session);
    let sessionJson;
    try {
        // La sesión solo contiene datos JSON; rechazar Buffers incluso anidados.
        const rejectBuffers = value => {
            if (Buffer.isBuffer(value)) throw new Error("Buffer");
            if (value && typeof value === "object") {
                for (const child of Object.values(value)) rejectBuffers(child);
            }
        };
        rejectBuffers(session);
        sessionJson = JSON.stringify(session);
    } catch {
        throw new Error("Invalid session: expected serializable data without Buffers");
    }
    const client = await getClient();
    try {
        await client.upsertEntity({
            partitionKey: PARTITION_KEY,
            rowKey,
            sessionJson,
            createdAt: session.createdAt.toISOString(),
            updatedAt: session.updatedAt.toISOString()
        }, "Replace");
    } catch {
        throw new Error("Failed to save session to Table Storage");
    }
}

async function deleteSession(userId) {
    const rowKey = sessionKey(userId);
    const client = await getClient();
    try {
        await client.deleteEntity(PARTITION_KEY, rowKey);
    } catch (error) {
        if (error.statusCode === 404 && (!error.code || error.code === "ResourceNotFound")) return;
        throw new Error("Failed to delete session from Table Storage");
    }
}

function getSessionTtlMilliseconds() {
    const value = process.env.SESSION_TTL_MINUTES;
    if (value === undefined) return 30 * 60 * 1000;
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) ||
        Number(value) < 1 || Number(value) > 1440) {
        throw new Error("Invalid SESSION_TTL_MINUTES: expected an integer from 1 to 1440");
    }
    return Number(value) * 60 * 1000;
}

function createNewSession(previousSession) {
    const session = {
        state: "START",
        eventId: crypto.randomUUID(),
        data: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        messageReceipts: previousSession?.messageReceipts || []
    };
    pruneMessageReceipts(session);
    return session;
}

async function getOrCreateSession(userId) {
    const ttl = getSessionTtlMilliseconds();
    const existing = await getSession(userId);
    if (existing && existing.state !== "COMPLETE" &&
        Date.now() - existing.updatedAt.getTime() < ttl) {
        return existing;
    }
    const session = createNewSession(existing);
    await saveSession(userId, session);
    return session;
}

module.exports = { getSession, saveSession, deleteSession, getOrCreateSession };
