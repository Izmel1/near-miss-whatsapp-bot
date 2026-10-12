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
