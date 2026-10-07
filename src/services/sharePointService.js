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

module.exports = {
    getGraphAccessToken,
    getAreas,
    getConsequences,
    resolveAreaId,
    resolveConsequenceIds
};
