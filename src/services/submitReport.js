const { createNearMissItem } = require("./sharePointService");
const { persistEvidenceImages } = require("./evidenceService");

async function submitReport(session, userId, context) {
    if (!session || typeof session !== "object" || !session.data ||
        typeof session.data !== "object") {
        throw new Error("Invalid session: expected a session with data");
    }
    if (session.state !== "SUBMIT") {
        throw new Error("Invalid session state: expected SUBMIT");
    }
    if (typeof userId !== "string" || userId.trim() === "") {
        throw new Error("Invalid userId: expected a non-empty string");
    }
    const images = Array.isArray(session.data.images) ? session.data.images : [];
    if (images.length > 5) {
        throw new Error("Invalid evidence images: maximum 5 images");
    }
    if (session.data.hasEvidence !== (images.length > 0)) {
        throw new Error("Invalid evidence state: hasEvidence must match images");
    }
    const hasItemId = session.data.sharePointItemId != null;
    const hasFolio = session.data.folio != null;
    if (hasItemId !== hasFolio) {
        throw new Error("Invalid persisted Near Miss state: item ID and folio must both exist");
    }
    if (hasItemId && (
        (typeof session.data.sharePointItemId !== "string" && typeof session.data.sharePointItemId !== "number") ||
        !Number.isSafeInteger(Number(session.data.sharePointItemId)) ||
        Number(session.data.sharePointItemId) <= 0 ||
        typeof session.data.folio !== "string" ||
        !/^SEG-\d{4}-\d{5,}$/.test(session.data.folio)
    )) {
        throw new Error("Invalid persisted Near Miss state: invalid item ID or folio");
    }
    const report = {
        eventId: session.eventId,
        fechaHoraReporte: new Date().toISOString(),
        numeroEmpleado: session.data.identity,
        whatsappUserId: userId,
        area: session.data.area,
        ubicacion: session.data.location,
        descripcion: session.data.description,
        consequences: session.data.consequences,
        otherConsequence: session.data.otherConsequence || "",
        prevention: session.data.prevention,
        hasEvidence: session.data.hasEvidence === true
    };
    let created = {
        id: session.data.sharePointItemId,
        folio: session.data.folio,
        webUrl: null
    };
    if (!hasItemId) {
        try {
            created = await createNearMissItem(report);
        } catch (error) {
            throw new Error("Failed to persist Near Miss: " + error.message);
        }
        session.data.sharePointItemId = created.id;
        session.data.folio = created.folio;
        session.updatedAt = new Date();
    }
    let evidenceResults = [];
    if (images.length > 0) {
        try {
            evidenceResults = await persistEvidenceImages({
                images,
                eventId: session.eventId,
                folio: created.folio,
                nearMissItemId: created.id
            });
        } catch (error) {
            throw new Error("Failed to persist Near Miss evidence: " + error.message);
        }
    }
    session.data.evidenceCount = evidenceResults.length;
    session.state = "COMPLETE";
    session.updatedAt = new Date();
    context.log("Near Miss persisted in SharePoint");
    context.log("SharePoint item ID:", created.id);
    context.log("Folio:", created.folio);
    context.log("Evidence images persisted:", evidenceResults.length);
    return {
        id: created.id,
        folio: created.folio,
        webUrl: created.webUrl,
        evidenceCount: evidenceResults.length
    };
}

module.exports = submitReport;
