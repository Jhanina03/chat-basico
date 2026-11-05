import { randomUUID } from 'node:crypto';

/**
 * Genera identificadores únicos con UUID v4.
 */
export class UuidGenerator {
  /** @returns {string} */
  next() {
    return randomUUID();
  }
}
