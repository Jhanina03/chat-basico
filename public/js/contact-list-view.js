/**
 * Lista de usuarios conectados con el botón para iniciar una videollamada.
 */
export class ContactListView {
  #dom;
  #list;
  #users = [];
  #selfId = null;
  #callingEnabled = true;
  #onCall = () => {};

  /**
   * @param {import('./dom-factory.js').DomFactory} dom
   */
  constructor(dom) {
    this.#dom = dom;
    this.#list = dom.byId('user-list');
  }

  /**
   * @param {(contact: { id: string, name: string }) => void} handler
   */
  onCall(handler) {
    this.#onCall = handler;
  }

  /**
   * @param {{ id: string, name: string }[]} users
   * @param {string | null} selfId el usuario actual no se muestra en la lista
   */
  render(users, selfId) {
    this.#users = [...users];
    this.#selfId = selfId;
    this.#draw();
  }

  /**
   * @param {boolean} enabled false mientras hay una llamada en curso
   */
  setCallingEnabled(enabled) {
    this.#callingEnabled = enabled;
    this.#draw();
  }

  #draw() {
    const others = this.#users.filter((user) => user.id !== this.#selfId);
    if (others.length === 0) {
      this.#list.replaceChildren(this.#dom.textElement('li', 'user-empty', 'No hay nadie más conectado'));
      return;
    }
    this.#list.replaceChildren(...others.map((user) => this.#createItem(user)));
  }

  #createItem(user) {
    const item = this.#dom.textElement('li', 'user-item', '');
    const callButton = this.#dom.button('Videollamada', 'call-button');
    callButton.setAttribute('aria-label', `Videollamada con ${user.name}`);
    callButton.disabled = !this.#callingEnabled;
    callButton.addEventListener('click', () => this.#onCall(user));
    item.append(this.#dom.textElement('span', 'user-name', user.name), callButton);
    return item;
  }
}
