const { downloadTwilioMedia } = require("./twilioMediaService");
const { uploadEvidenceFile, updateEvidenceMetadata } = require("./sharePointEvidenceService");

async function persistEvidenceImages({ images, eventId, folio, nearMissItemId } = {}) {
    if (!Array.isArray(images) || images.length > 5) {
        throw new Error("Invalid evidence images: expected an array of 0 to 5 images");
    }
    if (typeof eventId !== "string" || !eventId.trim()) {
        throw new Error("Invalid evidence eventId");
    }
    if (typeof folio !== "string" || !/^SEG-\d{4}-\d{5,}$/.test(folio)) {
        throw new Error("Invalid evidence folio");
    }
    if ((typeof nearMissItemId !== "string" && typeof nearMissItemId !== "number") ||
        (typeof nearMissItemId === "string" && !/^\d+$/.test(nearMissItemId.trim())) ||
        !Number.isSafeInteger(Number(nearMissItemId)) || Number(nearMissItemId) <= 0) {
        throw new Error("Invalid Near Miss item ID");
    }
    const results = [];
    for (let offset = 0; offset < images.length; offset++) {
        const index = offset + 1;
        try {
            const image = images[offset];
            if (typeof image?.messageId !== "string" || !image.messageId.trim()) {
                throw new Error("Invalid evidence provider message ID");
            }
            const downloaded = await downloadTwilioMedia(image);
            let extension;
            if (downloaded.mimeType === "image/jpeg" || downloaded.mimeType === "image/jpg") {
                extension = "jpg";
            } else if (downloaded.mimeType === "image/png") {
                extension = "png";
            } else {
                throw new Error("Unsupported evidence MIME type");
            }
            const fileName = `${folio}_${String(index).padStart(2, "0")}.${extension}`;
            const uploaded = await uploadEvidenceFile({
                buffer: downloaded.buffer,
                fileName,
                mimeType: downloaded.mimeType
            });
            await updateEvidenceMetadata({
                driveItemId: uploaded.id,
                eventId,
                folio,
                nearMissItemId,
                providerMessageId: image.messageId,
                mimeType: downloaded.mimeType,
                fechaCarga: new Date().toISOString(),
                canalOrigen: "WhatsApp"
            });
            results.push({
                index,
                fileName,
                driveItemId: uploaded.id,
                mimeType: downloaded.mimeType,
                size: downloaded.size
            });
        } catch (error) {
            throw new Error(`Failed to persist evidence image ${index}: ${error.message}`);
        }
    }
    return results;
}

module.exports = { persistEvidenceImages };
