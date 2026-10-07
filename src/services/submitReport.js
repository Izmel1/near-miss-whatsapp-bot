const { createNearMissItem } = require("./sharePointService");

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
    let created;
    try {
        created = await createNearMissItem(report);
    } catch (error) {
        throw new Error("Failed to persist Near Miss: " + error.message);
    }
    session.data.sharePointItemId = created.id;
    session.data.folio = created.folio;
    session.state = "COMPLETE";
    session.updatedAt = new Date();
    context.log("Near Miss persisted in SharePoint");
    context.log("SharePoint item ID:", created.id);
    context.log("Folio:", created.folio);
    return { id: created.id, folio: created.folio, webUrl: created.webUrl };
}

module.exports = submitReport;
