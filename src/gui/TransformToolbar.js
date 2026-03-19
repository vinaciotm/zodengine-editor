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
    );

    this.#keyHandler = (e) => {
      // Don't trigger when typing in inputs
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
      <span style="font-size:11px;color:var(--text-dim)">Del: delete &nbsp;|&nbsp; Dbl-click: rename</span>
    `;

    this.#el.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => this.#editor.setTransformMode(btn.dataset.mode));
    });
  }
}
