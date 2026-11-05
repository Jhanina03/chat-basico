const MEDIA_CONSTRAINTS = Object.freeze({ video: true, audio: true });

const MEDIA_ERROR_MESSAGES = Object.freeze({
  NotAllowedError: 'No diste permiso para usar la cámara o el micrófono.',
  NotFoundError: 'No se encontró cámara o micrófono.',
  NotReadableError: 'La cámara o el micrófono están siendo usados por otra aplicación.',
});

const UNSUPPORTED_MESSAGE = 'Este navegador no permite videollamadas (se necesita HTTPS).';
const GENERIC_MESSAGE = 'No se pudo abrir la cámara o el micrófono.';

/**
 * Error con un mensaje que se puede mostrar al usuario.
 */
export class MediaAccessError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'MediaAccessError';
  }
}

/**
 * Abre y libera la cámara y el micrófono del usuario.
 */
export class LocalMediaProvider {
  #mediaDevices;

  /**
   * @param {MediaDevices | undefined} mediaDevices
   */
  constructor(mediaDevices) {
    this.#mediaDevices = mediaDevices;
  }

  /**
   * @returns {Promise<MediaStream>}
   * @throws {MediaAccessError} si no hay permiso, cámara o soporte del navegador
   */
  async open() {
    if (typeof this.#mediaDevices?.getUserMedia !== 'function') {
      throw new MediaAccessError(UNSUPPORTED_MESSAGE);
    }
    try {
      return await this.#mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
    } catch (error) {
      throw new MediaAccessError(MEDIA_ERROR_MESSAGES[error.name] ?? GENERIC_MESSAGE, { cause: error });
    }
  }

  /**
   * Apaga la cámara y el micrófono.
   * @param {MediaStream | null} stream
   */
  release(stream) {
    for (const track of stream?.getTracks() ?? []) {
      track.stop();
    }
  }
}
