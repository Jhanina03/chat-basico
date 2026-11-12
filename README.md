# Chat Básico

Chat en tiempo real con **videollamada**, sin login: escribes tu nombre, mandas mensajes y llamas
por video a cualquier persona conectada.

- **Demo:** https://chat-basico.onrender.com
- **Tecnologías:** Node.js 22, Express, Socket.IO, WebRTC y SQLite (incluido en Node).

## Ejecutar en tu PC

```bash
npm install
npm start
```

Abre http://localhost:3000 en dos pestañas o en otro dispositivo de la misma red.

## Calidad

```bash
npm test           # pruebas automáticas (unitarias, integración, concurrencia, interfaz)
npm run coverage   # pruebas con reporte de cobertura
npm run lint       # ESLint con las reglas de SonarJS
npm run mutation   # pruebas de mutación con Stryker (reporte en reports/mutation)
npm run audit:prod # vulnerabilidades en dependencias de producción
```

Cada subida a GitHub ejecuta todo lo anterior en GitHub Actions (`.github/workflows/ci.yml`)
y SonarQube Cloud analiza el código.

## Reglas de negocio

| Regla | Dónde se aplica | Prueba |
|---|---|---|
| Hay que entrar con un nombre antes de enviar mensajes o llamar | `MessagingController`, `CallSignalingController` | `chat-server.test.js` |
| Solo se entra una vez por conexión (no se cambia el nombre después) | `UserSession.join`, `PresenceController` | `security-and-config.test.js`, `chat-server.test.js` |
| No hay dos usuarios conectados con el mismo nombre | `DisplayNamePolicy.normalizeUnique`, `UserDirectory` | `domain.test.js`, `chat-server.test.js` |
| Máximo 100 usuarios en el chat y 300 conexiones | `ChatRoom.isFull`, `ConnectionAdmission` | `chat-server.test.js` |
| Mensajes de 1 a 500 caracteres visibles; nombres hasta 30 | `TextSanitizer`, `MessageFactory` | `domain.test.js` |
| Un mensaje se guarda **antes** de repartirse; si falla el guardado no se reparte | `MessagingController` | `chat-server.test.js` (fallo de base de datos) |
| Un reintento del mismo mensaje no se duplica | `SqliteMessageRepository.save` (`clientMessageId` único) | `persistence.test.js`, `chat-server.test.js` |
| Se conservan los últimos 50 mensajes | `SqliteMessageRepository` | `persistence.test.js` |
| Solo una videollamada a la vez; si estás ocupado se responde "ocupado" | `CallCoordinator` | `call-coordinator.test.js` |

## Configuración (variables de entorno)

| Variable | Por defecto | Para qué sirve |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `DATABASE_PATH` | `data/chat.sqlite` | Archivo de la base de datos |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` o `error` |
| `METRICS_TOKEN` | (vacío: `/metrics` desactivado) | Token de 32+ caracteres para leer las métricas |
| `TRUST_PROXY_HOPS` | `1` en Render, `0` en otro lugar | Saltos de proxy confiables para leer la IP real |
| `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | (vacío) | Servidor TURN para redes muy cerradas |

Si alguna variable tiene un valor inválido, el servidor no arranca y lo registra en el log.

## Observabilidad

- **Logs estructurados:** una línea JSON por evento (`server_started`, `socket_connected`, `socket_rejected`,
  `socket_handler_failed`, `http_request_failed`…), con `connectionId` o `requestId` para seguir cada caso.
  Los textos de los mensajes y los secretos nunca se escriben.
- **Correlación:** cada respuesta HTTP lleva `X-Request-Id`; los errores muestran ese id al usuario.
- **Métricas Prometheus:** `GET /metrics` con `Authorization: Bearer <METRICS_TOKEN>`.
- **Salud:** `GET /health` (lo usa Render para saber si el servicio está vivo).

## Cómo funciona la videollamada

1. El video viaja **directo entre los dos navegadores** (WebRTC). No pasa por el servidor.
2. El servidor solo reenvía los datos para conectarse (oferta, respuesta y candidatos ICE),
   después de validarlos, y solo a la persona indicada.
3. Los servidores STUN públicos ayudan a encontrar la ruta entre redes. En algunas redes móviles
   hace falta un servidor TURN (variables `TURN_*`).

## Documentos

- [SECURITY.md](SECURITY.md): modelo de amenazas, controles y riesgos aceptados.
- `docs/EVIDENCIAS.md`: evidencias de calidad por cada criterio de evaluación.

## Despliegue en Render

1. **New → Web Service** y elige el repositorio (o usa `render.yaml`).
2. Build Command: `npm ci`. Start Command: `npm start`. Instance Type: `Free`.
3. Opcional: `METRICS_TOKEN`, `TURN_*` y un disco persistente con `DATABASE_PATH`.

> En el plan gratis el servicio se duerme tras 15 minutos sin uso y el disco se borra al redesplegar.
