# Chat Básico

Chat en tiempo real muy simple, sin login: escribes tu nombre y mandas mensajes.
Hecho con Node.js, Express y Socket.IO.

## Ejecutar en tu PC

```bash
npm install
npm start
```

Abre http://localhost:3000 en dos pestañas (o desde otro dispositivo en la misma red) y chatea.

## Pruebas

```bash
npm test
```

Con reporte de cobertura:

```bash
npm run coverage
```

## Estructura

| Archivo | Responsabilidad |
|---|---|
| `server.js` | Punto de entrada: lee el puerto y apaga el servidor de forma ordenada. |
| `src/start.js` | Arranca el servidor y maneja errores de arranque. |
| `src/app.js` | Une las piezas (web, Socket.IO, eventos). |
| `src/http-app.js` | Aplicación web: archivos, cabeceras de seguridad, `/health`, `/api/config`. |
| `src/chat-handlers.js` | Eventos del chat: entrar, enviar mensaje, salir. |
| `src/messages.js` | Limpieza y validación de textos, creación de mensajes e historial. |
| `src/rate-limiter.js` | Anti-spam: máximo de mensajes por intervalo. |
| `src/origin.js` | Rechaza conexiones desde otros sitios web. |
| `src/config.js` | Límites del chat en un solo lugar. |
| `public/chat-ui.js` | Interfaz del chat en el navegador. |

## Seguridad

- Mensajes mostrados con `textContent` (sin `innerHTML`): protección contra XSS.
- Validación en el servidor: tipo, longitud, caracteres de control y de dirección del texto.
- Límite de 5 mensajes cada 5 segundos por usuario.
- Solo se aceptan conexiones desde la misma página (cabecera `Origin`).
- Paquetes de máximo 16 KB.
- Cabeceras de seguridad con `helmet` y sin `x-powered-by`.

## Publicar en Render (gratis)

1. Sube este proyecto a un repositorio público de GitHub.
2. Entra a https://render.com e inicia sesión con GitHub.
3. **New → Web Service** y elige el repositorio.
4. Configura:
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: `Free`
5. Pulsa **Deploy**. Render te da un link `https://<nombre>.onrender.com` que cualquiera puede abrir.

> El plan gratis se "duerme" tras 15 minutos sin uso; la primera visita después tarda unos 30–60 segundos en despertar.
> Los mensajes se guardan en memoria (últimos 50) y se borran cuando el servidor se reinicia.

## Análisis con SonarQube Cloud

1. Entra a https://sonarcloud.io con tu cuenta de GitHub.
2. **+ → Analyze new project**, elige el repositorio y usa **Automatic Analysis**.
3. El archivo `.sonarcloud.properties` ya indica qué carpetas son código y cuáles son pruebas.
