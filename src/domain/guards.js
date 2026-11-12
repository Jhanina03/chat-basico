/**
 * Comprobaciones de valores que se repiten en varias clases del dominio.
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>} true si es un objeto simple (no null ni arreglo)
 */
export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @param {string} description nombre del valor para el mensaje de error
 * @returns {number} el mismo valor si es válido
 * @throws {RangeError} si no es un entero mayor que cero
 */
export function requirePositiveInteger(value, description) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${description} debe ser un entero positivo`);
  }
  return value;
}
