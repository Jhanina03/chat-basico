/**
 * Pantalla de videollamada y aviso de llamada entrante.
 */
export class CallView {
  #incomingDialog;
  #incomingText;
  #acceptButton;
  #rejectButton;
  #panel;
  #statusLabel;
  #localVideo;
  #remoteVideo;
  #hangUpButton;

  /**
   * @param {import('./dom-factory.js').DomFactory} dom
   */
  constructor(dom) {
    this.#incomingDialog = dom.byId('incoming-call');
    this.#incomingText = dom.byId('incoming-text');
    this.#acceptButton = dom.byId('accept-call');
    this.#rejectButton = dom.byId('reject-call');
    this.#panel = dom.byId('call-panel');
    this.#statusLabel = dom.byId('call-status');
    this.#localVideo = dom.byId('local-video');
    this.#remoteVideo = dom.byId('remote-video');
    this.#hangUpButton = dom.byId('hang-up');
  }

  /** @param {() => void} handler */
  onAccept(handler) {
    this.#acceptButton.addEventListener('click', handler);
  }

  /** @param {() => void} handler */
  onReject(handler) {
    this.#rejectButton.addEventListener('click', handler);
  }

  /** @param {() => void} handler */
  onHangUp(handler) {
    this.#hangUpButton.addEventListener('click', handler);
  }

  /** @param {string} callerName */
  showIncoming(callerName) {
    this.#incomingText.textContent = `${callerName} te está llamando`;
    this.#incomingDialog.hidden = false;
  }

  hideIncoming() {
    this.#incomingDialog.hidden = true;
  }

  /** @param {string} statusText */
  showCall(statusText) {
    this.setStatus(statusText);
    this.#panel.hidden = false;
  }

  /** @param {string} text */
  setStatus(text) {
    this.#statusLabel.textContent = text;
  }

  /** @param {MediaStream} stream */
  showLocalStream(stream) {
    this.#localVideo.srcObject = stream;
  }

  /** @param {MediaStream} stream */
  showRemoteStream(stream) {
    this.#remoteVideo.srcObject = stream;
  }

  hideCall() {
    this.#panel.hidden = true;
    this.#localVideo.srcObject = null;
    this.#remoteVideo.srcObject = null;
  }
}
