const crypto = require("crypto");

const sessions = new Map();

function getOrCreateSession(userId) {
    if (!sessions.has(userId)) {
        sessions.set(userId, {
            state: "START",
            eventId: crypto.randomUUID(),
            data: {},
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }

    return sessions.get(userId);
}

module.exports = {
    getOrCreateSession
};
