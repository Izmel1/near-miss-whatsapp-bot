async function normalizeTwilioMessage(request) {
    const form = new URLSearchParams(await request.text());
    const messageId = form.get("MessageSid");
    const bodyText = form.get("Body") || "";
    const mimeType = form.get("MediaContentType0");
    const isImage = Number(form.get("NumMedia") || 0) > 0 &&
        (mimeType || "").startsWith("image/");

    return {
        name: form.get("ProfileName") || "Sin nombre",
        userId: form.get("From")?.replace(/^whatsapp:/, ""),
        messageId,
        type: isImage ? "image" : "text",
        text: bodyText,
        imageId: isImage ? `${messageId}:0` : null,
        mediaUrl: isImage ? form.get("MediaUrl0") : null,
        mimeType: isImage ? mimeType : null,
        caption: isImage ? bodyText : null
    };
}

module.exports = normalizeTwilioMessage;
