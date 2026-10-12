const { safeLog, safeError } = require("../utils/safeLogger");
const generateFolio = require("../utils/generateFolio");
const { createNearMissItem, findNearMissByEventId, updateNearMissFolio } = require("./sharePointService");
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
    if (session.data.folio != null && session.data.sharePointItemId == null) {
        throw new Error("Invalid persisted Near Miss state: folio without item ID");
    }
    let created;
    if (session.data.sharePointItemId != null && session.data.folio != null) {
        created = { id: session.data.sharePointItemId, folio: session.data.folio, webUrl: null };
        const date = new Date(session.data.fechaHoraReporte || report.fechaHoraReporte);
        if (Number.isNaN(date.getTime())) throw new Error("Invalid report date");
        if (generateFolio(created.id, date.getUTCFullYear()) !== created.folio) {
            throw new Error("Near Miss folio mismatch");
        }
    } else {
        created = await findNearMissByEventId(session.eventId);
        if (!created && session.data.sharePointItemId != null) {
            throw new Error("Persisted Near Miss item not found by EventID");
        }
        if (!created) {
            try {
                created = await createNearMissItem(report, { deferFolio: true });
            } catch (error) {
                if (error.nearMissCreateAmbiguous || error.nearMissConflictCandidate) {
                    try {
                        created = await findNearMissByEventId(session.eventId);
                    } catch (searchError) {
                        if (searchError.message === "Multiple Near Miss items found for EventID") throw searchError;
                        throw error;
                    }
                }
                if (!created) throw error;
            }
        }
        if (session.data.sharePointItemId != null &&
            String(session.data.sharePointItemId) !== String(created.id)) {
            throw new Error("Persisted Near Miss item ID mismatch");
        }
        session.data.sharePointItemId = created.id;
        session.updatedAt = new Date();
        const dateValue = created.fechaHoraReporte || session.data.fechaHoraReporte || report.fechaHoraReporte;
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) throw new Error("Invalid recovered Near Miss report date");
        session.data.fechaHoraReporte = dateValue;
        const expectedFolio = generateFolio(created.id, date.getUTCFullYear());
        if (created.folio && created.folio !== expectedFolio) throw new Error("Near Miss folio mismatch");
        if (!created.folio) await updateNearMissFolio(created.id, expectedFolio);
        created.folio = expectedFolio;
        session.data.folio = expectedFolio;
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
    safeLog(context, "Report submission completed", { operation: "submit" });
    
    
    safeLog(context, "Evidence persistence completed", { evidenceCount: evidenceResults.length });
    return {
        id: created.id,
        folio: created.folio,
        webUrl: created.webUrl,
        evidenceCount: evidenceResults.length
    };
}

module.exports = submitReport;
