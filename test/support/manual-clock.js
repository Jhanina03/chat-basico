/**
 * Reloj controlado por la prueba: el tiempo solo avanza cuando se llama a advance().
 */
export class ManualClock {
  #time;

  constructor(isoDate = '2026-01-01T10:00:00.000Z') {
    this.#time = new Date(isoDate).getTime();
  }

  now() {
    return new Date(this.#time);
  }

  advance(milliseconds) {
    this.#time += milliseconds;
  }
}
