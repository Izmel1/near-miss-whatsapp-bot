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

async function evidenceGraphError(response, prefix, token) {
    let detail = "";
    try {
        const body = await response.json();
        const code = body?.error?.code;
        const message = body?.error?.message;
        if (typeof code === "string" && typeof message === "string") {
            const diagnostic = `${code.trim()}: ${message.trim()}`;
            const secrets = [token, process.env.CLIENT_SECRET].filter(
                value => typeof value === "string" && value.length > 0
            );
            if (code.trim() && message.trim() &&
                !secrets.some(value => diagnostic.includes(value)) &&
                !/access_token|authorization|client_secret|bearer\s/i.test(diagnostic)) {
                detail = ` - ${diagnostic}`;
            }
        }
    } catch {
        // Conservar el status HTTP cuando el body no sea utilizable.
    }
    return new Error(`${prefix}: HTTP ${response.status}${detail}`);
}

async function updateEvidenceMetadata({
    driveItemId, eventId, folio, nearMissItemId,
    providerMessageId, mimeType, fechaCarga, canalOrigen
} = {}) {
    for (const [name, value] of Object.entries({ driveItemId, eventId, providerMessageId })) {
        if (typeof value !== "string" || !value.trim()) {
            throw new Error(`Invalid evidence ${name}`);
        }
    }
    if (typeof folio !== "string" || !/^SEG-\d{4}-\d{5,}$/.test(folio)) {
        throw new Error("Invalid evidence folio");
    }
    if ((typeof nearMissItemId !== "string" && typeof nearMissItemId !== "number") ||
        (typeof nearMissItemId === "string" && !/^\d+$/.test(nearMissItemId.trim())) ||
        !Number.isSafeInteger(Number(nearMissItemId)) || Number(nearMissItemId) <= 0) {
        throw new Error("Invalid Near Miss item ID");
    }
    if (!Object.prototype.hasOwnProperty.call(EXTENSIONS, mimeType)) {
        throw new Error("Unsupported evidence MIME type");
    }
    if (typeof fechaCarga !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(fechaCarga) ||
        Number.isNaN(Date.parse(fechaCarga)) ||
        new Date(fechaCarga).toISOString().slice(0, 19) !== fechaCarga.slice(0, 19)) {
        throw new Error("Invalid evidence fechaCarga: expected a valid ISO UTC date");
    }
    if (canalOrigen !== "WhatsApp") {
        throw new Error("Invalid evidence canalOrigen: expected WhatsApp");
    }
    const environment = {};
    for (const name of ["SHAREPOINT_SITE_ID", "SHAREPOINT_EVIDENCIAS_DRIVE_ID", "SHAREPOINT_EVIDENCIAS_LIST_ID"]) {
        const value = process.env[name];
        if (typeof value !== "string" || !value.trim()) {
            throw new Error(`Missing required environment variable: ${name}`);
        }
        environment[name] = value;
    }
    const token = await getGraphAccessToken();
    let response;
    try {
        response = await fetch(
            `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(environment.SHAREPOINT_EVIDENCIAS_DRIVE_ID)}/items/${encodeURIComponent(driveItemId)}?$expand=listItem`,
            { method: "GET", headers: { Authorization: `Bearer ${token}` } }
        );
    } catch {
        throw new Error("Failed to resolve SharePoint evidence ListItem: network error");
    }
    if (response.status !== 200) {
        throw await evidenceGraphError(response, "Failed to resolve SharePoint evidence ListItem", token);
    }
    let item;
    try {
        item = await response.json();
    } catch {
        throw new Error("Failed to resolve SharePoint evidence ListItem: invalid JSON response");
    }
    const listItemId = item?.listItem?.id;
    if (typeof listItemId !== "string" || !listItemId.trim()) {
        throw new Error("Evidence ListItem not found");
    }
    const fields = {
        EventID: eventId,
        Folio: folio,
        NearMissItemId: Number(nearMissItemId),
        ProviderMessageId: providerMessageId,
        MimeType: mimeType,
        FechaCarga: fechaCarga,
        CanalOrigen: canalOrigen
    };
    try {
        response = await fetch(
            `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(environment.SHAREPOINT_SITE_ID)}/lists/${encodeURIComponent(environment.SHAREPOINT_EVIDENCIAS_LIST_ID)}/items/${encodeURIComponent(listItemId)}/fields`,
            {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(fields)
            }
        );
    } catch {
        throw new Error("Failed to update SharePoint evidence metadata: network error");
    }
    if (response.status !== 200) {
        throw await evidenceGraphError(response, "Failed to update SharePoint evidence metadata", token);
    }
    return { driveItemId, listItemId, folio };
}

module.exports = { uploadEvidenceFile, updateEvidenceMetadata };
