/**
 * Conexión WebRTC directa entre dos navegadores (el video no pasa por el servidor).
 */
export class PeerSession {
  #connection;
  #pendingCandidates = [];
  #hasRemoteDescription = false;

  /**
   * @param {{
   *   createConnection: () => RTCPeerConnection,
   *   onCandidate: (candidate: RTCIceCandidateInit) => void,
   *   onRemoteStream: (stream: MediaStream) => void,
   *   onFailure: () => void,
   * }} options
   */
  constructor({ createConnection, onCandidate, onRemoteStream, onFailure }) {
    this.#connection = createConnection();
    this.#connection.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        onCandidate(event.candidate.toJSON());
      }
    });
    this.#connection.addEventListener('track', (event) => {
      onRemoteStream(event.streams[0]);
    });
    this.#connection.addEventListener('connectionstatechange', () => {
      if (this.#connection.connectionState === 'failed') {
        onFailure();
      }
    });
  }

  /**
   * @param {MediaStream} stream
   */
  addLocalStream(stream) {
    for (const track of stream.getTracks()) {
      this.#connection.addTrack(track, stream);
    }
  }

  /**
   * @returns {Promise<RTCSessionDescriptionInit>} oferta para enviar a la otra persona
   */
  async createOffer() {
    const offer = await this.#connection.createOffer();
    await this.#connection.setLocalDescription(offer);
    return PeerSession.#toPlainDescription(this.#connection.localDescription);
  }

  /**
   * @param {RTCSessionDescriptionInit} offer
   * @returns {Promise<RTCSessionDescriptionInit>} respuesta para enviar a quien llamó
   */
  async acceptOffer(offer) {
    await this.#applyRemoteDescription(offer);
    const answer = await this.#connection.createAnswer();
    await this.#connection.setLocalDescription(answer);
    return PeerSession.#toPlainDescription(this.#connection.localDescription);
  }

  /**
   * @param {RTCSessionDescriptionInit} answer
   */
  async acceptAnswer(answer) {
    await this.#applyRemoteDescription(answer);
  }

  /**
   * Los candidatos que llegan antes de la descripción remota se guardan y se aplican después.
   * @param {RTCIceCandidateInit} candidate
   */
  async addCandidate(candidate) {
    if (!this.#hasRemoteDescription) {
      this.#pendingCandidates.push(candidate);
      return;
    }
    await this.#connection.addIceCandidate(candidate);
  }

  close() {
    this.#connection.close();
  }

  async #applyRemoteDescription(description) {
    await this.#connection.setRemoteDescription(description);
    this.#hasRemoteDescription = true;
    const pending = this.#pendingCandidates.splice(0);
    await Promise.all(pending.map((candidate) => this.#connection.addIceCandidate(candidate)));
  }

  static #toPlainDescription(description) {
    return { type: description.type, sdp: description.sdp };
  }
}
