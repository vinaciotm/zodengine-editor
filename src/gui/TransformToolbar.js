export class TransformToolbar {
  #el = null;
  #editor = null;
  #unsubs = [];
  #keyHandler = null;

  constructor(editor) { this.#editor = editor; }

  mount(parent) {
    this.#el = document.createElement('div');
    this.#el.className = 'transform-toolbar';
    parent.appendChild(this.#el);
    this.#render();

    this.#unsubs.push(
      this.#editor.on('transformMode:changed', () => this.#render()),
      this.#editor.on('viewMode:changed', () => this.#syncViewSelect()),
    );

    this.#keyHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '1') this.#editor.setTransformMode('translate');
      else if (e.key === '2') this.#editor.setTransformMode('rotate');
      else if (e.key === '3') this.#editor.setTransformMode('scale');
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.#editor.selectedEntityId !== null) {
          this.#editor.deleteEntity(this.#editor.selectedEntityId);
        }
      }
    };
    window.addEventListener('keydown', this.#keyHandler);
  }

  destroy() {
    this.#unsubs.forEach(u => u());
    if (this.#keyHandler) window.removeEventListener('keydown', this.#keyHandler);
    this.#el?.remove();
  }

  #render() {
    const mode = this.#editor.transformMode;
    const viewMode = this.#editor.viewMode;
    this.#el.innerHTML = `
      <span class="transform-toolbar-label">Transform:</span>
      <button class="transform-btn${mode === 'translate' ? ' active' : ''}" data-mode="translate">
        &#8634; Position <span class="hotkey">[1]</span>
      </button>
      <button class="transform-btn${mode === 'rotate' ? ' active' : ''}" data-mode="rotate">
        &#8635; Rotation <span class="hotkey">[2]</span>
      </button>
      <button class="transform-btn${mode === 'scale' ? ' active' : ''}" data-mode="scale">
        &#8644; Scale <span class="hotkey">[3]</span>
      </button>
      <span style="flex:1"></span>
      <span class="transform-toolbar-label">View:</span>
      <select class="view-mode-select" id="view-mode-sel">
        <option value="default"${viewMode === 'default' ? ' selected' : ''}>Padrão</option>
        <option value="unlit"${viewMode === 'unlit' ? ' selected' : ''}>Sem Luz</option>
        <option value="wireframe"${viewMode === 'wireframe' ? ' selected' : ''}>Wireframe</option>
      </select>
    `;

    this.#el.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => this.#editor.setTransformMode(btn.dataset.mode));
    });

    this.#el.querySelector('#view-mode-sel').addEventListener('change', (e) => {
      this.#editor.setViewMode(e.target.value);
    });
  }

  #syncViewSelect() {
    const sel = this.#el?.querySelector('#view-mode-sel');
    if (sel) sel.value = this.#editor.viewMode;
  }
}
