# Informe de cierre — PASO 15.12

Implementación local completada. No se ejecutó commit, push ni deploy. No se contactó Azure, Graph, SharePoint ni Twilio durante las pruebas.

## Resultado verificable

- `npm test`: 22 pruebas, 22 PASS, 0 FAIL, sin omisiones.
- `npm run check:config` con entorno ficticio: 14 OK, 11 DEFAULT; exit 0.
- Auditor CLI sin variables obligatorias: exit 1, comprobado en la suite.
- `node --check`: los 36 JS de src/, scripts/ y test/ pasan; el test ampliado fue comprobado nuevamente.
- Búsqueda final: context.log/context.error aparecen exclusivamente en safeLogger; no hay console.log/error/warn en src.
- Comparación de los 33 JS originales de src, excluyendo imports y llamadas de logging y espacios: sin diferencias restantes. Las ediciones de estados/processor/submit/webhook se limitan a logging.

## Archivos

Creados:

- `src/utils/safeLogger.js`
- `scripts/check-config.js`
- `test/backend.test.js`
- `docs/Diagnostico_Logs_15_12.md`
- `docs/Checklist_Productivo_15_12.md`
- `docs/Informe_Cierre_15_12.md`

Modificados:

- `.gitignore`
- `package.json`
- `src/functions/webhook.js`
- `src/services/submitReport.js`
- `src/session/sessionProcessor.js`
- `src/states/area.js`
- `src/states/consequence.js`
- `src/states/description.js`
- `src/states/identity.js`
- `src/states/location.js`
- `src/states/media.js`
- `src/states/mediaDecision.js`
- `src/states/mediaMore.js`
- `src/states/otherConsequence.js`
- `src/states/prevention.js`
- `src/states/start.js`

package-lock.json no fue modificado; no hay dependencias nuevas.

## Diagnóstico y sanitización

- SEGURO: 44
- SENSIBLE: 4
- PII: 12
- DEMASIADO VERBOSO: 11

Se eliminaron los valores de identidad, descripción, ubicación, prevención, área, consecuencias, entradas inválidas, EventID, imageId/MessageSid, ID SharePoint y folio. Se retiraron copias de preguntas/opciones y decisiones redundantes. El diagnóstico individual de las 71 llamadas se reproduce al final.

Se conservaron eventos controlados de recepción/verificación, carga de sesión, transición, rechazo de input, imágenes y límites, finalización y fallos técnicos. Se añadieron firma aceptada, claim/reclaim, duplicados, lock adquirido/ocupado y recuperación por recibo. No se creó correlation ID; no es necesario para estos eventos.

Los eventos usan context.log/context.error. Metadata por allowlist, estados/operaciones también por enum, y error codes por lista explícita; no se registran errores crudos, message, stack, headers ni objetos completos. Los eventos External request retry/timed out están permitidos por el helper, pero no se añadieron callbacks ni cambios al servicio HTTP en este paso.

## safeLogger completo

```javascript
const EVENTS = new Set([
    "Webhook received", "Webhook verification requested", "Webhook verification succeeded",
    "Webhook verification rejected", "Webhook event ignored", "Twilio signature validated",
    "Twilio signature rejected", "Session loaded", "State transition", "Input rejected",
    "Image limit reached", "Image received", "Media continuation requested",
    "Report submission completed", "Evidence persistence completed", "Message duplicate",
    "Message claimed", "Session lock busy", "Session lock acquired", "Message receipt recovered",
    "Operation failed", "Report complete", "Unsupported state", "External request retry",
    "External request timed out"
]);
const STATES = new Set([
    "START", "IDENTITY", "AREA", "DESCRIPTION", "LOCATION", "CONSEQUENCE",
    "OTHER_CONSEQUENCE", "PREVENTION", "MEDIA_DECISION", "MEDIA", "MEDIA_MORE",
    "SUBMIT", "COMPLETE"
]);
const OPERATIONS = new Set([
    "webhook", "verification", "validation", "session", "session_save",
    "message_claim", "message_release", "message_complete", "lock", "lock_release",
    "heartbeat_stop", "submit", "evidence", "http"
]);
const ERROR_CODES = new Set([
    "TWILIO_VALIDATION_CONFIGURATION", "EXTERNAL_HTTP_TIMEOUT", "EXTERNAL_HTTP_NETWORK",
    "EVIDENCE_VALIDATION", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"
]);

function technicalMetadata(metadata) {
    const result = {};
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return result;
    for (const [key, value] of Object.entries(metadata)) {
        if (["state", "fromState", "toState"].includes(key) && STATES.has(value)) result[key] = value;
        else if (key === "operation" && OPERATIONS.has(value)) result[key] = value;
        else if (["reclaimed", "duplicate"].includes(key) && typeof value === "boolean") result[key] = value;
        else if (["attempt", "maxAttempts", "durationMs", "evidenceCount"].includes(key) &&
            typeof value === "number" && Number.isFinite(value) && value >= 0) result[key] = value;
        else if (key === "status" && Number.isInteger(value) && value >= 100 && value <= 599) result[key] = value;
    }
    return result;
}

function safeLog(context, event, metadata = {}) {
    if (!EVENTS.has(event)) throw new Error("Invalid technical log event");
    if (typeof context?.log === "function") {
        context.log({ event, ...technicalMetadata(metadata) });
    }
}

function safeError(context, event, error, metadata = {}) {
    if (!EVENTS.has(event)) throw new Error("Invalid technical log event");
    const record = { event, ...technicalMetadata(metadata) };
    if (ERROR_CODES.has(error?.code)) record.errorCode = error.code;
    const status = error?.statusCode ?? error?.status;
    if (Number.isInteger(status) && status >= 100 && status <= 599) record.status = status;
    if (typeof context?.error === "function") context.error(record);
}

module.exports = { safeLog, safeError };
```

## Pruebas automatizadas

- 1. Receipt uses SHA256, prunes old/invalid entries and retains at most 20
- 2. JPEG signature and MIME accepted
- 3. PNG signature and MIME accepted
- 4. MIME spoof and truncated images rejected
- 5. Oversized buffer and streamed evidence rejected
- 6. Duplicate COMPLETED claim returns persisted reply (409 without code)
- 7. Lost claim ownership cannot complete or release current owner's entity
- 8. Old session lock token cannot renew or delete a reclaimed lock
- 9. Expired session starts a new report preserving recent receipts
- 10. COMPLETE starts a new report preserving receipts
- 11. External GET retries 503 and returns 200
- 12. createNearMissItem POST is not retried after HTTP 503
- 13. Valid Twilio signature accepted without network
- 14. Invalid or tampered Twilio signature rejected
- 15. EventID recovery avoids a second create and reaches COMPLETE
- 16. Recovered folio mismatch fails before creating or uploading
- 17. Repeated evidence persistence uses the same deterministic filename
- 18. safeLogger drops arbitrary fields, objects, messages, stacks and unknown error codes
- 19. safeError retains only known technical error code and HTTP status
- 20. Configuration audit accepts fictitious settings and documented defaults
- 21. Configuration audit rejects missing secrets, invalid ranges and renewal >= TTL
- 22. Config CLI returns 0/1 without printing fictitious credentials

La suite utiliza node:test/assert, VM para mocks de imports directos, TableClient en memoria, fetch simulado y datos sintéticos. La firma utiliza el SDK Twilio local sin operaciones de red. El auditor CLI se ejecuta en procesos con env ficticio/vacío.

## Auditor completo

```javascript
// Presence/format audit only. Never print environment values or contact services.
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nonempty = value => typeof value === "string" && !!value.trim() && !/[\x00-\x1f\x7f]/.test(value);
const table = value => /^[A-Za-z][A-Za-z0-9]{2,62}$/.test(value);
const integer = (min, max) => value => /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max;
function webhookUrl(value) {
    try {
        const url = new URL(value);
        return value === value.trim() && url.protocol === "https:" && !url.username && !url.password && !url.hash;
    } catch { return false; }
}
function storageConnection(value) {
    if (value === "UseDevelopmentStorage=true") return true;
    if (!nonempty(value)) return false;
    const parts = Object.fromEntries(value.split(";").filter(Boolean).map(part => {
        const index = part.indexOf("=");
        return index > 0 ? [part.slice(0, index), part.slice(index + 1)] : ["", ""];
    }));
    const key = parts.AccountKey && /^[A-Za-z0-9+/]+={0,2}$/.test(parts.AccountKey);
    const sas = parts.SharedAccessSignature && /(?:^|&)sig=[^&]+/.test(parts.SharedAccessSignature);
    if (!key && !sas) return false;
    if (parts.TableEndpoint) {
        try {
            const url = new URL(parts.TableEndpoint);
            return url.protocol === "https:" && !url.username && !url.password;
        } catch { return false; }
    }
    return /^[a-z0-9]{3,24}$/.test(parts.AccountName || "") && parts.DefaultEndpointsProtocol === "https";
}
const rules = [
    ["TENANT_ID", guid], ["CLIENT_ID", guid], ["CLIENT_SECRET", nonempty],
    ["SHAREPOINT_SITE_ID", value => {
        const parts = value.split(",");
        return parts.length === 3 && /^[a-z0-9.-]+\.sharepoint\.com$/i.test(parts[0]) && guid.test(parts[1]) && guid.test(parts[2]);
    }],
    ["SHAREPOINT_NEARMISS_LIST_ID", guid], ["SHAREPOINT_AREAS_LIST_ID", guid],
    ["SHAREPOINT_CONSECUENCIAS_LIST_ID", guid], ["SHAREPOINT_EVIDENCIAS_DRIVE_ID", value => /^[A-Za-z0-9_!-]+$/.test(value)],
    ["SHAREPOINT_EVIDENCIAS_LIST_ID", guid], ["TWILIO_API_KEY", /^SK[0-9a-f]{32}$/i],
    ["TWILIO_API_SECRET", nonempty], ["TWILIO_AUTH_TOKEN", nonempty], ["TWILIO_WEBHOOK_URL", webhookUrl],
    ["SESSION_STORAGE_CONNECTION_STRING", storageConnection],
    ["SESSION_TABLE_NAME", table, "NearMissSessions"], ["SESSION_TTL_MINUTES", integer(1, 1440), "30"],
    ["MESSAGE_IDEMPOTENCY_TABLE_NAME", table, "NearMissProcessedMessages"],
    ["MESSAGE_PROCESSING_TTL_SECONDS", integer(1, 3600), "600"],
    ["SESSION_LOCK_TABLE_NAME", table, "NearMissSessionLocks"], ["SESSION_LOCK_SECONDS", integer(1, 300), "120"],
    ["SESSION_LOCK_RENEW_SECONDS", integer(1, 299), "30"],
    ["EXTERNAL_HTTP_TIMEOUT_MS", integer(1000, 60000), "15000"],
    ["EXTERNAL_HTTP_MAX_ATTEMPTS", integer(1, 5), "3"], ["EXTERNAL_HTTP_RETRY_BASE_MS", integer(100, 5000), "500"],
    ["EVIDENCE_MAX_BYTES", integer(1048576, 20971520), "10485760"]
];
function auditConfig(env = process.env) {
    return rules.map(([name, validator, fallback]) => {
        const missing = env[name] === undefined;
        const value = missing ? fallback : env[name];
        let valid = typeof value === "string" && (validator instanceof RegExp ? validator.test(value) : validator(value));
        if (name === "SESSION_LOCK_RENEW_SECONDS") {
            valid = valid && Number(value) < Number(env.SESSION_LOCK_SECONDS ?? "120");
        }
        return { name, status: valid ? (missing ? "DEFAULT" : "OK") : "ERROR" };
    });
}
if (require.main === module) {
    const results = auditConfig();
    for (const { name, status } of results) console.log(`[${status}] ${name}`);
    process.exitCode = results.some(result => result.status === "ERROR") ? 1 : 0;
}
module.exports = { auditConfig };
```

Valida 25 variables, límites numéricos compatibles con los módulos existentes y renovación menor que TTL del lock. DEFAULT aplica solo si la variable no está definida. No imprime valores, longitudes, prefijos ni sufijos de secretos. La conexión de desarrollo explícita UseDevelopmentStorage=true se acepta como configuración local; esto no prueba su idoneidad para producción. No valida permisos/vigencia/conectividad ni existencia de recursos.

## Higiene del paquete

.gitignore agregó:

```gitignore
near-miss-deploy.zip
near-miss-deploy-*.zip
```

`git check-ignore` confirmó local.settings.json, .env, .env.test, node_modules y ambos patrones de ZIP. .env.* ya existía. No se borró ningún ZIP ni se ignoró código fuente. .funcignore no cambió; antes del deploy revisar paquete real, ya que ignorar en Git no es garantía de exclusión en todo empaquetador.

# Cierre productivo 15.12

## Antes del deploy

- Ejecutar `npm test` y comprobar cero fallos.
- Ejecutar `npm run check:config` en el entorno de destino. El auditor valida presencia/formato, no permisos ni conectividad.
- Comprobar sintaxis de todos los JS del proyecto (excluir dependencias).
- Cargar configuración mediante el mecanismo de secretos del entorno, sin imprimirla ni incluir `local.settings.json` en el paquete.
- Confirmar permisos Graph, acceso a las tres tablas, catálogos activos, biblioteca y columnas de evidencias. Confirmar que la unicidad de EventID está configurada en SharePoint; un 400/409 por sí solo no la demuestra.
- Confirmar que `TWILIO_WEBHOOK_URL` coincide exactamente con la URL pública que firma Twilio y que el intervalo de renovación es menor que la duración del lock.
- Revisar el contenido del paquete antes de publicarlo: sin ZIP anidados, secretos, settings locales ni archivos de pruebas. `.gitignore` impide commits accidentales; no controla todos los métodos de empaquetado.
- No se ejecutó deploy como parte de este paso.

## Pruebas reales después del deploy

Usar reportes de prueba identificables en SharePoint. No copiar teléfonos, credenciales, firmas, URLs de medios o cuerpos completos a logs/documentos de diagnóstico. Marcar cada prueba con fecha, PASS/FAIL y observación técnica.

| # | Acción | Resultado esperado |
|---|---|---|
| 1 | Enviar texto inicial por WhatsApp. | Respuesta normal del bot. |
| 2 | Completar reporte sin foto. | Un Near Miss, folio correcto, cero evidencias. |
| 3 | Completar reporte con un JPEG. | Un Near Miss y una evidencia `.jpg` con metadatos correspondientes. |
| 4 | Completar reporte con un PNG. | Un Near Miss y una evidencia `.png` con metadatos correspondientes. |
| 5 | Enviar dos fotos consecutivas. | Dos evidencias, nombres deterministas con índices 01 y 02. |
| 6 | Enviar opción inválida en AREA y CONSEQUENCE. | Mensaje de validación; el estado no avanza. |
| 7 | Enviar nuevo mensaje tras COMPLETE. | Nueva sesión/reporte con EventID distinto; recibos recientes conservados. |
| 8 | Conversar con dos usuarios simultáneos. | Sesiones independientes; respuestas y reportes no se mezclan. |
| 9 | Enviar webhook de formulario sin firma válida. | HTTP 403; no crea sesión ni claim. |
| 10 | Reenviar de forma controlada el mismo MessageSid con firma válida. | No aplica dos veces la transición ni crea otro reporte. La respuesta depende de si está PROCESSING o COMPLETED. |
| 11 | Revisar SEG - Near Miss tras las pruebas. | No hay duplicados por EventID y los folios coinciden con el ID/año del reporte. |
| 12 | Revisar SEG - Evidencias tras las pruebas y reenvíos. | No hay archivos duplicados para el mismo nombre determinista; metadatos correctos. |
| 13 | Revisar Application Insights/logs de Azure. | Solo eventos técnicos: sin matrícula, descripción, ubicación, prevención, teléfono, Body, MessageSid/EventID completos, folio innecesario, URL media, secretos, tokens de ownership, ETag, errores crudos ni buffers. |

## Límites de esta validación

Las pruebas automatizadas usan dependencias externas simuladas y credenciales ficticias. No acreditan permisos, conectividad, configuración real de UNIQUE, comportamiento del despliegue o entrega real de Twilio. El auditor tampoco valida vigencia de secretos o existencia de recursos.

La validación de imágenes existente comprueba tamaño, MIME y firma/integridad básica; no es antivirus ni decodificación exhaustiva. Managed Identity, colas, WAF, dashboards, alertas, Power Apps y cambios de arquitectura permanecen fuera de alcance. Los logs del SDK/plataforma y su retención deben revisarse en la prueba 13; el helper controla los logs explícitos de la aplicación.


## Confirmación funcional

No se modificaron preguntas, opciones, estados del flujo, folio, campos SharePoint, evidencias, firma, idempotencia, locks, heartbeat ni TTL. Los módulos funcionales sin logs permanecen intactos; los archivos modificados en src solo cambian observabilidad. Las pruebas externas reales permanecen pendientes del deploy autorizado por el usuario.

# Diagnóstico de logs — PASO 15.12

Inventario previo al cambio. Las líneas corresponden a la versión inspeccionada, no a la salida final. No se incluyen valores reales.

| Archivo | Línea | Clase | Hallazgo |
|---|---:|---|---|
| src/functions/webhook.js | 50 | SEGURO | Intento de verificación recibido |
| src/functions/webhook.js | 59 | SEGURO | Webhook verificado correctamente |
| src/functions/webhook.js | 69 | SEGURO | Verificación rechazada |
| src/functions/webhook.js | 98 | SEGURO | Webhook recibido |
| src/functions/webhook.js | 117 | SEGURO | Invalid Twilio webhook signature |
| src/functions/webhook.js | 147 | SEGURO | No se encontró mensaje en el payload |
| src/functions/webhook.js | 221 | SENSIBLE | Event ID: |
| src/functions/webhook.js | 226 | SEGURO | Estado antes: |
| src/functions/webhook.js | 248 | SEGURO | Failed to save session after processing failure |
| src/functions/webhook.js | 258 | SEGURO | Estado después: |
| src/functions/webhook.js | 281 | SEGURO | Failed to release message idempotency claim |
| src/functions/webhook.js | 284 | SEGURO | TWILIO_VALIDATION_CONFIGURATION |
| src/functions/webhook.js | 297 | SEGURO | Failed to stop session lock heartbeat |
| src/functions/webhook.js | 304 | SEGURO | Failed to release session lock |
| src/services/submitReport.js | 99 | SEGURO | Near Miss persisted in SharePoint |
| src/services/submitReport.js | 100 | SENSIBLE | SharePoint item ID: |
| src/services/submitReport.js | 101 | SENSIBLE | Folio: |
| src/services/submitReport.js | 102 | SEGURO | Evidence images persisted: |
| src/session/sessionProcessor.js | 116 | SEGURO | Reporte completado |
| src/session/sessionProcessor.js | 121 | SEGURO | Estado aún no implementado: |
| src/states/area.js | 8 | PII | Área inválida: |
| src/states/area.js | 26 | PII | Área guardada: |
| src/states/area.js | 31 | SEGURO | Cambio de estado: AREA -> DESCRIPTION |
| src/states/consequence.js | 10 | PII | Consecuencia inválida: |
| src/states/consequence.js | 15 | DEMASIADO VERBOSO | Opciones válidas: 1,2,3,4,5,6,7,8 |
| src/states/consequence.js | 40 | PII | Consecuencias guardadas: |
| src/states/consequence.js | 52 | SEGURO | Cambio de estado: CONSEQUENCE -> OTHER_CONSEQUENCE |
| src/states/consequence.js | 68 | SEGURO | Cambio de estado: CONSEQUENCE -> PREVENTION |
| src/states/description.js | 8 | SEGURO | Descripción inválida |
| src/states/description.js | 24 | PII | Descripción guardada: |
| src/states/description.js | 29 | SEGURO | Cambio de estado: DESCRIPTION -> LOCATION |
| src/states/identity.js | 10 | SEGURO | Identificación inválida |
| src/states/identity.js | 24 | PII | Identidad guardada: |
| src/states/identity.js | 29 | SEGURO | Cambio de estado: IDENTITY -> AREA |
| src/states/location.js | 10 | SEGURO | Ubicación inválida |
| src/states/location.js | 26 | PII | Ubicación guardada: |
| src/states/location.js | 35 | SEGURO | Cambio de estado: LOCATION -> CONSEQUENCE |
| src/states/media.js | 28 | SEGURO | Formato de imagen no permitido: |
| src/states/media.js | 34 | SEGURO | Límite máximo de 5 imágenes alcanzado |
| src/states/media.js | 50 | SENSIBLE | Imagen registrada: |
| src/states/media.js | 51 | SEGURO | Total de imágenes: |
| src/states/media.js | 66 | SEGURO | Máximo de 5 imágenes recibido |
| src/states/media.js | 67 | SEGURO | Cambio de estado: [estado] -> SUBMIT |
| src/states/media.js | 79 | SEGURO | Cambio de estado: [estado] -> MEDIA_MORE |
| src/states/media.js | 80 | DEMASIADO VERBOSO | ¿Deseas agregar más imágenes? 1 = Sí, 2 = Enviar reporte |
| src/states/media.js | 117 | DEMASIADO VERBOSO | Usuario decidió continuar |
| src/states/media.js | 121 | DEMASIADO VERBOSO | Tiene evidencia: |
| src/states/media.js | 126 | SEGURO | Cambio de estado: MEDIA -> SUBMIT |
| src/states/media.js | 139 | PII | Entrada no válida en MEDIA: |
| src/states/media.js | 144 | DEMASIADO VERBOSO | Debe enviar una imagen o escribir Continuar |
| src/states/media.js | 156 | SEGURO | Tipo de mensaje no soportado en MEDIA: |
| src/states/mediaDecision.js | 15 | DEMASIADO VERBOSO | Usuario indicó que sí tiene fotografías |
| src/states/mediaDecision.js | 19 | SEGURO | Cambio de estado: MEDIA_DECISION -> MEDIA |
| src/states/mediaDecision.js | 39 | DEMASIADO VERBOSO | Usuario indicó que no tiene fotografías |
| src/states/mediaDecision.js | 43 | SEGURO | Cambio de estado: MEDIA_DECISION -> SUBMIT |
| src/states/mediaDecision.js | 55 | PII | Respuesta inválida en MEDIA_DECISION: |
| src/states/mediaDecision.js | 60 | DEMASIADO VERBOSO | Opciones válidas: 1 = Sí, 2 = No |
| src/states/mediaMore.js | 5 | SEGURO | Imagen recibida directamente en MEDIA_MORE |
| src/states/mediaMore.js | 21 | DEMASIADO VERBOSO | Usuario desea agregar otra imagen |
| src/states/mediaMore.js | 25 | SEGURO | Cambio de estado: MEDIA_MORE -> MEDIA |
| src/states/mediaMore.js | 40 | DEMASIADO VERBOSO | Usuario decidió enviar el reporte |
| src/states/mediaMore.js | 44 | SEGURO | Cambio de estado: MEDIA_MORE -> SUBMIT |
| src/states/mediaMore.js | 56 | PII | Respuesta inválida en MEDIA_MORE: |
| src/states/mediaMore.js | 61 | DEMASIADO VERBOSO | Opciones válidas: 1 = Sí, 2 = Enviar reporte |
| src/states/otherConsequence.js | 8 | SEGURO | Descripción de otra consecuencia vacía |
| src/states/otherConsequence.js | 28 | PII | Otra consecuencia guardada: |
| src/states/otherConsequence.js | 33 | SEGURO | Cambio de estado: OTHER_CONSEQUENCE -> PREVENTION |
| src/states/prevention.js | 8 | SEGURO | Propuesta preventiva vacía |
| src/states/prevention.js | 29 | PII | Propuesta preventiva guardada: |
| src/states/prevention.js | 34 | SEGURO | Cambio de estado: PREVENTION -> MEDIA_DECISION |
| src/states/start.js | 4 | SEGURO | Cambio de estado: START -> IDENTITY |

Total: 71 llamadas.
