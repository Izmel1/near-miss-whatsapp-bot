async function normalizeTwilioMessage(request) {
    const form = new URLSearchParams(await request.text());
    const messageId = form.get("MessageSid");
    const bodyText = form.get("Body") || "";
    const rawNumMedia = Number(form.get("NumMedia") || 0);
    const numMedia = Number.isSafeInteger(rawNumMedia) && rawNumMedia > 0
        ? rawNumMedia
        : 0;
    const mediaItems = [];

    for (let index = 0; index < numMedia; index++) {
        const mimeType = form.get(`MediaContentType${index}`);
        if (!(mimeType || "").startsWith("image/")) {
            continue;
        }

        mediaItems.push({
            imageId: `${messageId}:${index}`,
            mediaUrl: form.get(`MediaUrl${index}`),
            mimeType,
            caption: index === 0 ? bodyText : null,
            messageId
        });
    }

    const firstImage = mediaItems[0];

    return {
        name: form.get("ProfileName") || "Sin nombre",
        userId: form.get("From")?.replace(/^whatsapp:/, ""),
        messageId,
        type: firstImage ? "image" : "text",
        text: bodyText,
        imageId: firstImage ? firstImage.imageId : null,
        mediaUrl: firstImage ? firstImage.mediaUrl : null,
        mimeType: firstImage ? firstImage.mimeType : null,
        caption: firstImage ? firstImage.caption : null,
        mediaItems
    };
}

module.exports = normalizeTwilioMessage;
