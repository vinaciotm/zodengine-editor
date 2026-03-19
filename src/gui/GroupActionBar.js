export class GroupActionBar {
  #el = null;
  #editor = null;
  #unsubs = [];
  #keyHandler = null;

  constructor(editor) { this.#editor = editor; }

  mount(parent) {
    this.#el = document.createElement('div');
    this.#el.className = 'group-action-bar';
    this.#el.style.display = 'none';
    parent.appendChild(this.#el);

    this.#unsubs.push(
      this.#editor.on('selection:changed', (ids, primary) => this.#onSelectionChanged(ids, primary)),
    );

    this.#keyHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'g' || e.key === 'G') {
        if (this.#editor.selectedEntityIds.size >= 2) {
          e.preventDefault();
          this.#editor.groupSelectedEntities();
        }
      }
    };
    window.addEventListener('keydown', this.#keyHandler);

    this.#render();
  }

  destroy() {
    this.#unsubs.forEach(u => u());
    if (this.#keyHandler) window.removeEventListener('keydown', this.#keyHandler);
    this.#el?.remove();
  }

  #onSelectionChanged(ids, primary) {
    if (!this.#el) return;
    if (ids.size >= 2) {
      this.#el.style.display = 'flex';
      this.#render();
    } else {
      this.#el.style.display = 'none';
    }
  }

  #render() {
    const count = this.#editor.selectedEntityIds.size;
    this.#el.innerHTML = `
      <span class="group-bar-label">&#128257; ${count} objects selected</span>
      <button class="group-bar-btn primary" id="gb-group">&#128257; Group <kbd>G</kbd></button>
      <button class="group-bar-btn" id="gb-cancel">Cancel</button>
    `;
    this.#el.querySelector('#gb-group').addEventListener('click', () => {
      this.#editor.groupSelectedEntities();
    });
    this.#el.querySelector('#gb-cancel').addEventListener('click', () => {
      this.#editor.clearSelection();
    });
  }
}
