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
