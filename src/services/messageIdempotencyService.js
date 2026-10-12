const crypto = require("crypto");
const { TableClient } = require("@azure/data-tables");
const PARTITION_KEY = "TwilioMessage";
let clientPromise;

function processingTtl() {
    const value = process.env.MESSAGE_PROCESSING_TTL_SECONDS;
    if (value === undefined) return 600000;
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 3600) {
        throw new Error("Invalid MESSAGE_PROCESSING_TTL_SECONDS: expected an integer from 1 to 3600");
    }
    return Number(value) * 1000;
}

function validateToken(token) {
    if (typeof token !== "string" || !token.trim()) throw new Error("Invalid message claim token");
}

function messageKey(messageId) {
    if (typeof messageId !== "string" || !messageId.trim()) {
        throw new Error("Invalid idempotency message ID");
    }
    return crypto.createHash("sha256").update(messageId.trim()).digest("hex");
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
                    process.env.MESSAGE_IDEMPOTENCY_TABLE_NAME || "NearMissProcessedMessages",
                    { retryOptions: { maxRetries: 0 } }
                );
                try {
                    await client.createTable();
                } catch (error) {
                    if (error?.statusCode !== 409) throw error;
                }
                return client;
            } catch {
                throw new Error("Failed to initialize message idempotency storage");
            }
        })();
        clientPromise.catch(() => { clientPromise = undefined; });
    }
    return clientPromise;
}

async function claimMessage(messageId) {
    const rowKey = messageKey(messageId);
    const ttl = processingTtl();
    const client = await getClient();
    const now = new Date().toISOString();
    const token = crypto.randomUUID();
    try {
        await client.createEntity({
            partitionKey: PARTITION_KEY, rowKey,
            status: "PROCESSING", createdAt: now, updatedAt: now,
            claimToken: token,
            processingExpiresAt: new Date(Date.now() + ttl).toISOString(),
            reply: "", hasReply: false
        });
        return { status: "CLAIMED", token, reclaimed: false };
    } catch (error) {
        if (error?.statusCode !== 409) {
            throw new Error("Failed to claim message in idempotency storage");
        }
    }
    let entity;
    try {
        entity = await client.getEntity(PARTITION_KEY, rowKey);
    } catch {
        throw new Error("Failed to read message idempotency status");
    }
    if (entity.status === "PROCESSING") {
        const updated = typeof entity.updatedAt === "string" ? Date.parse(entity.updatedAt) : NaN;
        const created = typeof entity.createdAt === "string" ? Date.parse(entity.createdAt) : NaN;
        const hasExpiry = entity.processingExpiresAt !== undefined && entity.processingExpiresAt !== null;
        const expiry = hasExpiry
            ? (typeof entity.processingExpiresAt === "string" ? Date.parse(entity.processingExpiresAt) : NaN)
            : updated + ttl;
        if (!Number.isFinite(updated) || !Number.isFinite(created) ||
            !Number.isFinite(expiry) || !entity.etag) {
            throw new Error("Invalid stored message processing timestamps");
        }
        if (expiry > Date.now()) return { status: "PROCESSING" };
        const reclaimedAt = new Date().toISOString();
        try {
            await client.updateEntity({
                partitionKey: PARTITION_KEY, rowKey,
                status: "PROCESSING", claimToken: token,
                updatedAt: reclaimedAt,
                processingExpiresAt: new Date(Date.now() + ttl).toISOString()
            }, "Merge", { etag: entity.etag });
            return { status: "CLAIMED", token, reclaimed: true };
        } catch (error) {
            if (error?.statusCode === 412 || error?.statusCode === 404) return { status: "PROCESSING" };
            throw new Error("Failed to reclaim expired message claim");
        }
    }
    if (entity.status === "COMPLETED" && typeof entity.reply === "string" &&
        typeof entity.hasReply === "boolean") {
        return { status: "COMPLETED", reply: entity.hasReply ? entity.reply : null };
    }
    throw new Error("Invalid stored message idempotency status");
}

async function completeMessage(messageId, claimToken, reply) {
    const rowKey = messageKey(messageId);
    validateToken(claimToken);
    if (reply !== null && typeof reply !== "string") {
        throw new Error("Invalid idempotency reply: expected string or null");
    }
    const client = await getClient();
    let entity;
    try {
        entity = await client.getEntity(PARTITION_KEY, rowKey);
    } catch {
        throw new Error("Failed to read message claim for completion");
    }
    if (entity.status !== "PROCESSING" || entity.claimToken !== claimToken) {
        throw new Error("Message claim ownership lost");
    }
    if (!entity.etag) throw new Error("Invalid stored message claim ETag");
    try {
        await client.updateEntity({
            partitionKey: PARTITION_KEY, rowKey,
            status: "COMPLETED", reply: reply === null ? "" : reply,
            hasReply: reply !== null, updatedAt: new Date().toISOString(),
            claimToken: "", processingExpiresAt: ""
        }, "Merge", { etag: entity.etag });
    } catch (error) {
        if (error?.statusCode === 412) throw new Error("Message claim ownership lost");
        throw new Error("Failed to complete message in idempotency storage");
    }
}

async function releaseMessage(messageId, claimToken) {
    const rowKey = messageKey(messageId);
    validateToken(claimToken);
    const client = await getClient();
    try {
        const entity = await client.getEntity(PARTITION_KEY, rowKey);
        if (entity.status === "COMPLETED") return;
        if (entity.status === "PROCESSING" && entity.claimToken !== claimToken) return;
        if (entity.status !== "PROCESSING" || !entity.etag) throw new Error("Invalid status");
        await client.deleteEntity(PARTITION_KEY, rowKey, { etag: entity.etag });
    } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 412) return;
        throw new Error("Failed to release message in idempotency storage");
    }
}

module.exports = { claimMessage, completeMessage, releaseMessage };
