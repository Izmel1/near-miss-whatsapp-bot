const crypto = require("crypto");
const MAX_RECEIPTS = 20;
const RETENTION_MS = 24 * 60 * 60 * 1000;

function hashMessageId(messageId) {
    if (typeof messageId !== "string" || !messageId.trim()) {
        throw new Error("Invalid receipt message ID");
    }
    return crypto.createHash("sha256").update(messageId.trim()).digest("hex");
}

function pruneMessageReceipts(session) {
    if (!session || typeof session !== "object") throw new Error("Invalid receipt session");
    const now = Date.now();
    const receipts = Array.isArray(session.messageReceipts) ? session.messageReceipts : [];
    const unique = new Map();
    for (const receipt of receipts) {
        if (!receipt || typeof receipt.messageKey !== "string" ||
            !/^[a-f0-9]{64}$/.test(receipt.messageKey) ||
            (receipt.reply !== null && typeof receipt.reply !== "string") ||
            typeof receipt.appliedAt !== "string") continue;
        const time = Date.parse(receipt.appliedAt);
        if (!Number.isFinite(time) || time > now || now - time > RETENTION_MS) continue;
        const previous = unique.get(receipt.messageKey);
        if (!previous || Date.parse(previous.appliedAt) <= time) {
            unique.set(receipt.messageKey, {
                messageKey: receipt.messageKey,
                reply: receipt.reply,
                appliedAt: receipt.appliedAt
            });
        }
    }
    session.messageReceipts = [...unique.values()]
        .sort((a, b) => Date.parse(a.appliedAt) - Date.parse(b.appliedAt))
        .slice(-MAX_RECEIPTS);
    return session.messageReceipts;
}

function findMessageReceipt(session, messageId) {
    const key = hashMessageId(messageId);
    return pruneMessageReceipts(session).find(receipt => receipt.messageKey === key) || null;
}

function recordMessageReceipt(session, messageId, reply) {
    const key = hashMessageId(messageId);
    if (reply !== null && typeof reply !== "string") {
        throw new Error("Invalid receipt reply: expected string or null");
    }
    pruneMessageReceipts(session);
    session.messageReceipts = session.messageReceipts.filter(receipt => receipt.messageKey !== key);
    session.messageReceipts.push({ messageKey: key, reply, appliedAt: new Date().toISOString() });
    pruneMessageReceipts(session);
}

module.exports = { hashMessageId, findMessageReceipt, recordMessageReceipt, pruneMessageReceipts };
