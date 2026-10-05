async function submitReport(session, context) {
    context.log("Inicio de SUBMIT: reporte listo para persistencia");
    context.log("Event ID:", session.eventId);
    context.log(
        "Datos finales:",
        JSON.stringify(session.data, null, 2)
    );

    session.state = "COMPLETE";
    session.updatedAt = new Date();

    context.log("Fin de SUBMIT: preparación del reporte completada");
    context.log("Cambio de estado: SUBMIT -> COMPLETE");
}

module.exports = submitReport;
