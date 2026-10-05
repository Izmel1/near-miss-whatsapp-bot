function normalizeMetaMessage(message, contact) {
    const type =
        message.type;

    return {

        name:
            contact?.profile?.name ||
            "Sin nombre",

        userId:
            message.from,

        messageId:
            message.id,

        type: type,

        text:
            type === "text"
                ? message.text?.body
                : null,

        imageId:
            type === "image"
                ? message.image?.id
                : null,

        mimeType:
            type === "image"
                ? message.image?.mime_type
                : null,

        caption:
            type === "image"
                ? message.image?.caption || null
                : null
    };
}

module.exports = normalizeMetaMessage;
