/** Caracteres de control y de dirección del texto (se usan para disfrazar contenido). */
const UNSAFE_CHARACTERS = /[\p{Cc}\p{Bidi_Control}]/gu;

/**
 * Limpia textos escritos por los usuarios.
 */
export class TextSanitizer {
  #segmenter = new Intl.Segmenter('es', { granularity: 'grapheme' });

  /**
   * Quita caracteres peligrosos y espacios extremos, y recorta sin partir emojis.
   * @param {unknown} value
   * @param {number} maxLength cantidad máxima de caracteres visibles
   * @returns {string} texto limpio, o vacío si el valor no es texto
   */
  clean(value, maxLength) {
    if (typeof value !== 'string') {
      return '';
    }
    const withoutUnsafe = value.replaceAll(UNSAFE_CHARACTERS, '').trim();
    return this.#truncate(withoutUnsafe, maxLength).trim();
  }

  #truncate(text, maxLength) {
    const graphemes = Array.from(this.#segmenter.segment(text), ({ segment }) => segment);
    return graphemes.slice(0, maxLength).join('');
  }
}
