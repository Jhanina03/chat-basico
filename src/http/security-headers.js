import helmet from 'helmet';

/** Solo esta página puede usar la cámara y el micrófono; nada puede usar ubicación ni pagos. */
const PERMISSIONS_POLICY = 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()';
const TWO_YEARS_IN_SECONDS = 63_072_000;
const SELF = "'self'";
const NONE = "'none'";

/**
 * Política de seguridad de contenido estricta: solo recursos de este mismo sitio,
 * sin estilos ni scripts en línea, sin plugins y sin que otra página pueda incrustar el chat.
 */
const CONTENT_SECURITY_POLICY = Object.freeze({
  useDefaults: false,
  directives: {
    defaultSrc: [SELF],
    baseUri: [SELF],
    connectSrc: [SELF],
    fontSrc: [SELF],
    formAction: [SELF],
    frameAncestors: [NONE],
    frameSrc: [NONE],
    imgSrc: [SELF],
    manifestSrc: [SELF],
    mediaSrc: [SELF],
    objectSrc: [NONE],
    scriptSrc: [SELF],
    scriptSrcAttr: [NONE],
    styleSrc: [SELF],
    workerSrc: [SELF],
    upgradeInsecureRequests: [],
  },
});

/**
 * Cabeceras de seguridad comunes para TODAS las respuestas: las de Express y las de Socket.IO.
 * Las respuestas no se guardan en caché porque el chat muestra datos en tiempo real.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: (error?: unknown) => void) => void}
 */
export function createSecurityHeaders() {
  const helmetMiddleware = helmet({
    contentSecurityPolicy: CONTENT_SECURITY_POLICY,
    crossOriginEmbedderPolicy: { policy: 'require-corp' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: { maxAge: TWO_YEARS_IN_SECONDS, includeSubDomains: true, preload: true },
  });
  return (req, res, next) => {
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    res.setHeader('Cache-Control', 'no-store');
    helmetMiddleware(req, res, next);
  };
}
