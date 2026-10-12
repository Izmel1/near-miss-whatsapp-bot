const crypto = require("crypto");
const { TableClient } = require("@azure/data-tables");
const PARTITION_KEY = "TwilioMessage";
let clientPromise;

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
                    if (error.statusCode !== 409 || error.code !== "TableAlreadyExists") throw error;
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
    const client = await getClient();
    const now = new Date().toISOString();
    try {
        await client.createEntity({
            partitionKey: PARTITION_KEY, rowKey,
            status: "PROCESSING", createdAt: now, updatedAt: now,
            reply: "", hasReply: false
        });
        return { status: "CLAIMED" };
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
    if (entity.status === "PROCESSING") return { status: "PROCESSING" };
    if (entity.status === "COMPLETED" && typeof entity.reply === "string" &&
        typeof entity.hasReply === "boolean") {
        return { status: "COMPLETED", reply: entity.hasReply ? entity.reply : null };
    }
    throw new Error("Invalid stored message idempotency status");
}

async function completeMessage(messageId, reply) {
    const rowKey = messageKey(messageId);
    if (reply !== null && typeof reply !== "string") {
        throw new Error("Invalid idempotency reply: expected string or null");
    }
    const client = await getClient();
    try {
        const entity = await client.getEntity(PARTITION_KEY, rowKey);
        if (entity.status !== "PROCESSING") throw new Error("Invalid status");
        await client.updateEntity({
            partitionKey: PARTITION_KEY, rowKey,
            status: "COMPLETED", reply: reply === null ? "" : reply,
            hasReply: reply !== null, updatedAt: new Date().toISOString()
        }, "Merge", { etag: entity.etag });
    } catch {
        throw new Error("Failed to complete message in idempotency storage");
    }
}

async function releaseMessage(messageId) {
    const rowKey = messageKey(messageId);
    const client = await getClient();
    try {
        const entity = await client.getEntity(PARTITION_KEY, rowKey);
        if (entity.status === "COMPLETED") return;
        if (entity.status !== "PROCESSING" || !entity.etag) throw new Error("Invalid status");
        await client.deleteEntity(PARTITION_KEY, rowKey, { etag: entity.etag });
    } catch (error) {
        if (error.statusCode === 404 && error.code === "ResourceNotFound") return;
        throw new Error("Failed to release message in idempotency storage");
    }
}

module.exports = { claimMessage, completeMessage, releaseMessage };
