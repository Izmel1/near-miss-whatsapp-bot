const { getGraphAccessToken } = require("./sharePointService");

const EXTENSIONS = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/jpg": [".jpg", ".jpeg"],
    "image/png": [".png"]
};

async function uploadEvidenceFile({ buffer, fileName, mimeType } = {}) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new Error("Invalid evidence buffer");
    }
    if (typeof fileName !== "string" || !fileName.trim() ||
        /[/\\\x00-\x1f\x7f]/.test(fileName) || fileName.includes("..")) {
        throw new Error("Invalid evidence file name");
    }
    if (!Object.prototype.hasOwnProperty.call(EXTENSIONS, mimeType)) {
        throw new Error("Unsupported evidence MIME type");
    }
    if (!EXTENSIONS[mimeType].some(extension => fileName.toLowerCase().endsWith(extension))) {
        throw new Error("Evidence MIME type does not match file extension");
    }
    const driveId = process.env.SHAREPOINT_EVIDENCIAS_DRIVE_ID;
    if (typeof driveId !== "string" || !driveId.trim()) {
        throw new Error("Missing required environment variable: SHAREPOINT_EVIDENCIAS_DRIVE_ID");
    }
    const token = await getGraphAccessToken();
    let response;
    try {
        response = await fetch(
            `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${encodeURIComponent(fileName)}:/content`,
            {
                method: "PUT",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": mimeType },
                body: buffer
            }
        );
    } catch {
        throw new Error("Failed to upload SharePoint evidence: network error");
    }
    if (response.status !== 200 && response.status !== 201) {
        throw new Error(`Failed to upload SharePoint evidence: HTTP ${response.status}`);
    }
    let item;
    try {
        item = await response.json();
    } catch {
        throw new Error("Failed to upload SharePoint evidence: invalid JSON response");
    }
    if (typeof item?.id !== "string" || !item.id.trim()) {
        throw new Error("Failed to upload SharePoint evidence: item ID missing or invalid");
    }
    return {
        id: item.id,
        name: item.name,
        webUrl: item.webUrl || null,
        size: item.size
    };
}

module.exports = { uploadEvidenceFile };
