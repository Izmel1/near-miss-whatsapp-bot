const generateFolio = require("../utils/generateFolio");

function requireEnvironment(name) {
    const value = process.env[name];
    if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

async function getGraphAccessToken() {
    const tenantId = requireEnvironment("TENANT_ID");
    const clientId = requireEnvironment("CLIENT_ID");
    const clientSecret = requireEnvironment("CLIENT_SECRET");
    let response;

    try {
        response = await fetch(
            `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
            {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    scope: "https://graph.microsoft.com/.default",
                    grant_type: "client_credentials"
                })
            }
        );
    } catch {
        throw new Error("Microsoft Graph authentication failed: network error");
    }

    if (!response.ok) {
        throw new Error(`Microsoft Graph authentication failed: HTTP ${response.status}`);
    }

    let payload;
    try {
        payload = await response.json();
    } catch {
        throw new Error("Microsoft Graph authentication failed: invalid JSON response");
    }
    if (typeof payload?.access_token !== "string" || !payload.access_token.trim()) {
        throw new Error("Microsoft Graph authentication failed: access_token missing or invalid");
    }
    return payload.access_token;
}

async function getAreas() {
    const siteId = requireEnvironment("SHAREPOINT_SITE_ID");
    const listId = requireEnvironment("SHAREPOINT_AREAS_LIST_ID");
    const token = await getGraphAccessToken();
    let url = `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items?$expand=fields`;
    const areas = [];

    while (url) {
        let response;
        try {
            response = await fetch(url, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch {
            throw new Error("Failed to read SharePoint areas: network error");
        }
        if (!response.ok) {
            throw new Error(`Failed to read SharePoint areas: HTTP ${response.status}`);
        }

        let payload;
        try {
            payload = await response.json();
        } catch {
            throw new Error("Failed to read SharePoint areas: invalid JSON response");
        }
        if (!Array.isArray(payload?.value)) {
            throw new Error("Failed to read SharePoint areas: invalid items response");
        }
        for (const item of payload.value) {
            if (!item || !item.fields) {
                throw new Error("Failed to read SharePoint areas: item fields missing");
            }
            areas.push({
                id: item.id,
                code: item.fields.Codigo,
                name: item.fields.Title,
                active: item.fields.Activo
            });
        }

        const nextLink = payload["@odata.nextLink"];
        if (nextLink) {
            let nextUrl;
            try {
                nextUrl = new URL(nextLink);
            } catch {
                throw new Error("Failed to read SharePoint areas: invalid pagination URL");
            }
            if (nextUrl.origin !== "https://graph.microsoft.com") {
                throw new Error("Failed to read SharePoint areas: invalid pagination origin");
            }
            url = nextUrl.href;
        } else {
            url = null;
        }
    }
    return areas;
}

async function getConsequences() {
    const siteId = requireEnvironment("SHAREPOINT_SITE_ID");
    const listId = requireEnvironment("SHAREPOINT_CONSECUENCIAS_LIST_ID");
    const token = await getGraphAccessToken();
    let url = `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items?$expand=fields`;
    const consequences = [];

    while (url) {
        let response;
        try {
            response = await fetch(url, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch {
            throw new Error("Failed to read SharePoint consequences: network error");
        }
        if (!response.ok) {
            throw new Error(`Failed to read SharePoint consequences: HTTP ${response.status}`);
        }

        let payload;
        try {
            payload = await response.json();
        } catch {
            throw new Error("Failed to read SharePoint consequences: invalid JSON response");
        }
        if (!Array.isArray(payload?.value)) {
            throw new Error("Failed to read SharePoint consequences: invalid items response");
        }
        for (const item of payload.value) {
            if (!item || !item.fields) {
                throw new Error("Failed to read SharePoint consequences: item fields missing");
            }
            consequences.push({
                id: item.id,
                code: item.fields.Codigo,
                name: item.fields.Title,
                active: item.fields.Activo
            });
        }

        const nextLink = payload["@odata.nextLink"];
        if (nextLink) {
            let nextUrl;
            try {
                nextUrl = new URL(nextLink);
            } catch {
                throw new Error("Failed to read SharePoint consequences: invalid pagination URL");
            }
            if (nextUrl.origin !== "https://graph.microsoft.com") {
                throw new Error("Failed to read SharePoint consequences: invalid pagination origin");
            }
            url = nextUrl.href;
        } else {
            url = null;
        }
    }
    return consequences;
}

async function resolveAreaId(areaName) {
    if (typeof areaName !== "string" || areaName.trim() === "") {
        throw new Error("Invalid areaName: expected a non-empty string");
    }

    const name = areaName.trim();
    const areas = await getAreas();
    const area = areas.find(item =>
        item.active === true &&
        typeof item.name === "string" &&
        item.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (!area) {
        throw new Error(`SharePoint area not found or inactive: ${name}`);
    }
    return area.id;
}

async function resolveConsequenceIds(consequenceNames) {
    if (!Array.isArray(consequenceNames) || consequenceNames.length === 0) {
        throw new Error("Invalid consequenceNames: expected a non-empty array");
    }

    const names = [];
    for (const name of consequenceNames) {
        if (typeof name !== "string" || name.trim() === "") {
            throw new Error("Invalid consequenceNames: every element must be a non-empty string");
        }
        names.push(name.trim());
    }

    const consequences = await getConsequences();
    const ids = [];
    for (const name of names) {
        const consequence = consequences.find(item =>
            item.active === true &&
            typeof item.name === "string" &&
            item.name.trim().toLowerCase() === name.toLowerCase()
        );
        if (!consequence) {
            throw new Error(`SharePoint consequence not found or inactive: ${name}`);
        }
        if (!ids.includes(consequence.id)) {
            ids.push(consequence.id);
        }
    }
    return ids;
}

async function createNearMissItem(report) {
    if (!report || typeof report !== "object" || Array.isArray(report)) {
        throw new Error("Invalid report: expected an object");
    }
    const requiredFields = [
        "eventId", "fechaHoraReporte", "numeroEmpleado", "whatsappUserId",
        "area", "ubicacion", "descripcion", "prevention"
    ];
    for (const field of requiredFields) {
        if (typeof report[field] !== "string" || report[field].trim() === "") {
            throw new Error(`Invalid report field: ${field} must be a non-empty string`);
        }
    }
    if (!Array.isArray(report.consequences) || report.consequences.length === 0) {
        throw new Error("Invalid report field: consequences must be a non-empty array");
    }
    for (const name of report.consequences) {
        if (typeof name !== "string" || name.trim() === "") {
            throw new Error("Invalid report field: consequences must contain non-empty strings");
        }
    }
    if (report.otherConsequence != null && typeof report.otherConsequence !== "string") {
        throw new Error("Invalid report field: otherConsequence must be a string");
    }

    const reportDate = new Date(report.fechaHoraReporte);
    if (Number.isNaN(reportDate.getTime()) || reportDate.getUTCFullYear() < 1000 ||
        reportDate.getUTCFullYear() > 9999) {
        throw new Error("Invalid report field: fechaHoraReporte must be a valid date");
    }
    const siteId = requireEnvironment("SHAREPOINT_SITE_ID");
    const listId = requireEnvironment("SHAREPOINT_NEARMISS_LIST_ID");
    const areaId = await resolveAreaId(report.area);
    const consequenceIds = await resolveConsequenceIds(report.consequences);
    const areaLookupId = Number(areaId);
    const consequenceLookupIds = consequenceIds.map(Number);
    if (!Number.isSafeInteger(areaLookupId) || areaLookupId <= 0 ||
        consequenceLookupIds.some(id => !Number.isSafeInteger(id) || id <= 0)) {
        throw new Error("Invalid SharePoint Lookup ID: expected positive integers");
    }

    const payload = {
        fields: {
            Title: report.eventId,
            FechaHoraReporte: report.fechaHoraReporte,
            NumeroEmpleado: report.numeroEmpleado,
            WhatsAppUserId: report.whatsappUserId,
            AreaLookupId: areaLookupId,
            Ubicacion: report.ubicacion,
            Descripcion: report.descripcion,
            "ConsecuenciaPotencialLookupId@odata.type": "Collection(Edm.Int32)",
            ConsecuenciaPotencialLookupId: consequenceLookupIds,
            OtraConsecuencia: report.otherConsequence || "",
            PropuestaPrevencion: report.prevention,
            TieneEvidencia: report.hasEvidence === true,
            Estado: "Nuevo"
        }
    };
    const token = await getGraphAccessToken();
    let response;
    try {
        response = await fetch(
            `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            }
        );
    } catch {
        throw new Error("Failed to create SharePoint Near Miss: network error");
    }
    if (response.status !== 201) {
        throw new Error(`Failed to create SharePoint Near Miss: HTTP ${response.status}`);
    }
    let item;
    try {
        item = await response.json();
    } catch {
        throw new Error("Failed to create SharePoint Near Miss: invalid JSON response");
    }
    if (typeof item?.id !== "string" || !item.id.trim()) {
        throw new Error("Failed to create SharePoint Near Miss: item ID missing or invalid");
    }
    const folio = generateFolio(item.id, reportDate.getUTCFullYear());
    try {
        await updateNearMissFolio(item.id, folio);
    } catch (error) {
        throw new Error(`SharePoint Near Miss item ${item.id} created, but Folio update failed: ${error.message}`);
    }
    return {
        id: item.id,
        folio,
        webUrl: item.webUrl || null,
        fields: item.fields ? { ...item.fields, Folio: folio } : null
    };
}

async function updateNearMissFolio(itemId, folio) {
    // Reutiliza la validación del ID del generador existente.
    generateFolio(itemId, 2000);
    if (typeof folio !== "string" || !/^SEG-\d{4}-\d{5,}$/.test(folio)) {
        throw new Error("Invalid folio: expected SEG-AAAA-#####");
    }
    const siteId = requireEnvironment("SHAREPOINT_SITE_ID");
    const listId = requireEnvironment("SHAREPOINT_NEARMISS_LIST_ID");
    const token = await getGraphAccessToken();
    let response;
    try {
        response = await fetch(
            `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items/${Number(itemId)}/fields`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ Folio: folio })
            }
        );
    } catch {
        throw new Error("Failed to update SharePoint Near Miss Folio: network error");
    }
    if (response.status !== 200) {
        throw new Error(`Failed to update SharePoint Near Miss Folio: HTTP ${response.status}`);
    }
    return { id: String(Number(itemId)), folio };
}

module.exports = {
    getGraphAccessToken,
    getAreas,
    getConsequences,
    resolveAreaId,
    resolveConsequenceIds,
    createNearMissItem,
    updateNearMissFolio
};
