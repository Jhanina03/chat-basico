# Chat Básico

Chat en tiempo real con **videollamada**, sin login: escribes tu nombre, mandas mensajes y llamas
por video a cualquier persona conectada.
Hecho con Node.js, Express, Socket.IO y WebRTC.

## Ejecutar en tu PC

```bash
npm install
npm start
```

Abre http://localhost:3000 en dos pestañas o en otro dispositivo de la misma red.

## Pruebas y calidad

```bash
npm test           # 114 pruebas automáticas
npm run coverage   # pruebas con reporte de cobertura
npm run lint       # ESLint con las reglas de SonarJS
```

## Cómo funciona la videollamada

1. El video viaja **directo entre los dos navegadores** (WebRTC). No pasa por el servidor.
2. El servidor solo reenvía los datos para conectarse (oferta, respuesta y candidatos ICE).
   Esto se llama *señalización*. Valida cada señal y la reenvía solo a la persona indicada.
3. Los servidores STUN públicos ayudan a encontrar la ruta entre redes distintas.
   En algunas redes móviles muy cerradas hace falta un servidor TURN, que se configura así:

| Variable | Ejemplo |
|---|---|
| `TURN_URL` | `turn:turn.ejemplo.com:3478` (varias separadas por coma) |
| `TURN_USERNAME` | usuario del servidor TURN |
| `TURN_CREDENTIAL` | clave del servidor TURN |

## Diseño (SOLID)

### Servidor (`src/`)

| Clase | Responsabilidad |
|---|---|
| `EnvironmentConfig` | Lee el puerto y los servidores ICE desde las variables de entorno. |
| `TextSanitizer` | Quita caracteres peligrosos y recorta textos sin partir emojis. |
| `DisplayNamePolicy` | Decide el nombre que se muestra (limpio o "Anónimo"). |
| `MessageFactory` | Crea mensajes inmutables con id, autor, texto y fecha. |
| `MessageHistory` | Guarda los últimos 50 mensajes. |
| `UserDirectory` | Lista de usuarios conectados. |
| `CallSignalValidator` | Valida las señales de videollamada y quita campos no permitidos. |
| `RateLimiter` | Anti-spam: máximo de acciones por intervalo. |
| `OriginPolicy` | Rechaza conexiones que vienen de otros sitios web. |
| `UserSession` | Estado de cada conexión (nombre, si ya entró). |
| `SocketController` | Contrato común de los controladores (clase abstracta). |
| `ChatController` | Eventos del chat: entrar, enviar mensaje, salir. |
| `CallSignalingController` | Reenvía señales de videollamada entre dos usuarios. |
| `SocketGateway` | Crea una sesión por conexión y la entrega a los controladores. |
| `ChatServer` | Arranca y detiene el servidor de forma ordenada. |
| `SystemClock`, `UuidGenerator` | Reloj e identificadores (se reemplazan en las pruebas). |

### Navegador (`public/js/`)

| Clase | Responsabilidad |
|---|---|
| `DomFactory` | Crea elementos con `textContent` (protección XSS). |
| `JoinView` | Pantalla para escribir el nombre. |
| `MessageComposer` | Caja para escribir y enviar mensajes. |
| `ChatView` | Muestra mensajes, avisos y estado. |
| `UserListView` | Lista de conectados con botón de videollamada. |
| `CallView` | Pantalla de videollamada y aviso de llamada entrante. |
| `CallMessages` | Textos de la videollamada. |
| `CallSignaling` | Envía y recibe señales por Socket.IO. |
| `LocalMediaProvider` | Abre y apaga cámara y micrófono, con errores claros. |
| `PeerSession` | Conexión WebRTC con la otra persona. |
| `CallCoordinator` | Ciclo de la llamada: llamar, contestar, rechazar, colgar. |
| `ChatApplication` | Conecta las vistas con el servidor. |

### Cómo se aplica SOLID

- **S (responsabilidad única):** cada clase hace una sola cosa (ver tablas).
- **O (abierto/cerrado):** para agregar una función se crea otro `SocketController`, sin modificar los existentes.
  `CallSignalValidator` registra un validador por evento.
- **L (sustitución de Liskov):** `ChatController` y `CallSignalingController` se usan igual a través de `SocketController`.
- **I (segregación de interfaces):** las dependencias son pequeñas: reloj (`now()`), generador de id (`next()`), registrador (`info`, `warn`).
- **D (inversión de dependencias):** las clases reciben sus dependencias por el constructor.
  Solo `src/composition-root.js` y `public/js/main.js` crean las clases concretas.

`shared/protocol.js` tiene los nombres de los eventos y lo usan el servidor y el navegador.

## Seguridad

- Mensajes mostrados con `textContent`, nunca como HTML: protección contra XSS.
- Validación en el servidor de tipo, longitud, caracteres de control y de dirección del texto.
- Señales de videollamada validadas y reenviadas solo a usuarios conectados (nunca a uno mismo).
- Anti-spam: 5 mensajes cada 5 segundos y 100 señales cada 10 segundos por usuario.
- Solo se aceptan conexiones desde la misma página (cabecera `Origin`).
- Quien no dio su nombre no recibe mensajes ni puede enviarlos.
- Cabeceras de seguridad con `helmet`, `Permissions-Policy` (cámara solo para esta página) y sin `x-powered-by`.
- Paquetes de máximo 64 KB.

## Publicar en Render

1. **New → Web Service** y elige el repositorio.
2. Build Command: `npm install`. Start Command: `npm start`. Instance Type: `Free`.
3. (Opcional) Agrega las variables `TURN_URL`, `TURN_USERNAME` y `TURN_CREDENTIAL`.

> El plan gratis se duerme tras 15 minutos sin uso y los mensajes se guardan solo en memoria.
