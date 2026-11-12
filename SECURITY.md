# Seguridad

## Reportar una vulnerabilidad

Abre un *issue* privado (Security advisory) en GitHub o escribe a la autora del repositorio.
No publiques detalles de la vulnerabilidad hasta que esté corregida.

## Modelo de amenazas

El chat no tiene login (requisito del proyecto): cualquier persona con el link puede entrar con un nombre.
Por eso no hay datos de cuentas que proteger, y los controles se enfocan en abuso, inyección e integridad.

| Amenaza | Control | Evidencia (prueba automática) |
|---|---|---|
| XSS: inyectar HTML o JavaScript en mensajes o nombres | Todo el texto se inserta con `textContent`; CSP de `helmet` (`script-src 'self'`) | `test/client/views.test.js` (protección XSS) |
| Datos malformados o enormes | Validación en el servidor de tipo, longitud, UUID y caracteres de control; paquetes ≤ 64 KB | `domain.test.js`, `chat-server.test.js` (solicitudes inválidas) |
| Asignación masiva en señales de videollamada | `CallSignalValidator` copia solo los campos permitidos | `call-signal-validator.test.js` |
| Suplantación por nombre repetido | Nombres únicos entre conectados, sin importar mayúsculas ni letras de ancho completo | `domain.test.js`, `chat-server.test.js` |
| Texto engañoso con caracteres bidireccionales | Se eliminan los caracteres de control y Bidi | `domain.test.js` |
| Spam y denegación de servicio | Límite por usuario (mensajes y señales), por IP (HTTP), máximo de usuarios y de conexiones | `chat-server.test.js` (429, chat lleno, anti-spam) |
| Conexiones desde otros sitios (CSWSH) | `OriginPolicy` exige que el origen coincida con el host | `security-and-config.test.js`, `chat-server.test.js` |
| Señales a usuarios ajenos o inexistentes | Solo se reenvían a usuarios conectados, nunca a uno mismo ni desde quien no entró | `chat-server.test.js` |
| Mensajes duplicados por reintentos | `clientMessageId` único en la base de datos (idempotencia) | `persistence.test.js`, `chat-server.test.js` (carrera) |
| Corrupción de datos ante fallos | Cada guardado es una transacción (`BEGIN IMMEDIATE` / `ROLLBACK`) | `persistence.test.js` (fallo a mitad de transacción) |
| Fuga de información en errores | Respuestas genéricas con `requestId`; el detalle solo va al log | `observability.test.js` |
| Datos sensibles en logs | El logger redacta `text`, `token`, `credential`, `authorization`, `sdp` | `observability.test.js` |
| Acceso a métricas internas | `/metrics` desactivado sin `METRICS_TOKEN`; con token, comparación de tiempo constante | `chat-server.test.js`, `security-and-config.test.js` |
| Uso indebido de cámara o micrófono | `Permissions-Policy: camera=(self), microphone=(self)` | `chat-server.test.js` |
| Dependencias vulnerables | `npm audit` en CI y Dependabot semanal | `.github/workflows/ci.yml` |

## Riesgos aceptados (conocidos y documentados)

1. **Sin autenticación:** no se puede probar la identidad de nadie. Es un requisito del proyecto; los nombres únicos solo evitan la suplantación exacta.
2. **Caracteres parecidos (homoglifos):** "Аna" con A cirílica no se considera igual a "Ana".
3. **Credenciales TURN visibles:** si se configura un servidor TURN, el navegador necesita su usuario y clave. Usa credenciales de corta duración del proveedor.
4. **Persistencia en Render gratis:** el disco se borra al redesplegar; los mensajes se pierden. Con un disco persistente (`DATABASE_PATH`) se conservan.
5. **Una sola instancia:** el límite de mensajes y la sala viven en memoria. Para varias instancias haría falta Redis (adaptador de Socket.IO).
