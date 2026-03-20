import { sfx } from './sfx.js';

export class TransformToolbar {
  #el = null;
  #editor = null;
  #unsubs = [];
  #keyHandler = null;

  constructor(editor) { this.#editor = editor; }

  mount(parent) {
    this.#el = document.createElement('div');
    this.#el.className = 'viewport-toolbar';
    parent.appendChild(this.#el);
    this.#render();

    this.#unsubs.push(
      this.#editor.on('transformMode:changed', () => this.#render()),
      this.#editor.on('viewMode:changed', () => this.#render()),
      this.#editor.on('entity:selected', () => {
        const id = this.#editor.selectedEntityId;
        if (id !== null && this.#editor.isScaleLocked(id) && this.#editor.transformMode === 'scale') {
          this.#editor.setTransformMode('translate');
        }
        this.#render();
      }),
    );

    this.#keyHandler = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === '1') { sfx.click(); this.#editor.setTransformMode('translate'); }
      else if (e.key === '2') { sfx.click(); this.#editor.setTransformMode('rotate'); }
      else if (e.key === '3') {
        const id = this.#editor.selectedEntityId;
        if (!this.#editor.isScaleLocked(id)) { sfx.click(); this.#editor.setTransformMode('scale'); }
      }
      else if (e.key === '4') { sfx.click(); this.#editor.setViewMode('default'); }
      else if (e.key === '5') { sfx.click(); this.#editor.setViewMode('unlit'); }
      else if (e.key === '6') { sfx.click(); this.#editor.setViewMode('wireframe'); }
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
    const view = this.#editor.viewMode;

    const ico = {
      translate: `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="8" y1="1" x2="8" y2="15"/><line x1="1" y1="8" x2="15" y2="8"/>
        <polyline points="5.5,3.5 8,1 10.5,3.5"/><polyline points="5.5,12.5 8,15 10.5,12.5"/>
        <polyline points="3.5,5.5 1,8 3.5,10.5"/><polyline points="12.5,5.5 15,8 12.5,10.5"/>
      </svg>`,
      rotate: `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13.5 8a5.5 5.5 0 1 1-2-4.3"/>
        <polyline points="11.5,1 14,4 11,5.5"/>
      </svg>`,
      scale: `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="1,5 1,1 5,1"/><line x1="1" y1="1" x2="6.5" y2="6.5"/>
        <polyline points="15,5 15,1 11,1"/><line x1="15" y1="1" x2="9.5" y2="6.5"/>
        <polyline points="1,11 1,15 5,15"/><line x1="1" y1="15" x2="6.5" y2="9.5"/>
        <polyline points="15,11 15,15 11,15"/><line x1="15" y1="15" x2="9.5" y2="9.5"/>
      </svg>`,
      lit: `<svg viewBox="0 0 14 18" width="14" height="18" fill="currentColor">
        <path d="M3 7a4 4 0 0 1 8 0c0 2.2-1.5 3.8-2 5.5H5C4.5 10.8 3 9.2 3 7z"/>
        <rect x="5" y="13.5" width="4" height="1.5" rx=".5"/>
        <rect x="5.5" y="15.5" width="3" height="1" rx=".5"/>
        <line x1="7" y1="1" x2="7" y2="2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="11.5" y1="2.5" x2="10.5" y2="3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="2.5" y1="2.5" x2="3.5" y2="3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="13" y1="7" x2="11.5" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="1" y1="7" x2="2.5" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
      unlit: `<svg viewBox="0 0 14 18" width="14" height="18" fill="none" stroke="currentColor">
        <path d="M3 7a4 4 0 0 1 8 0c0 2.2-1.5 3.8-2 5.5H5C4.5 10.8 3 9.2 3 7z" stroke-width="1.2" fill="currentColor" opacity="0.25"/>
        <rect x="5" y="13.5" width="4" height="1.5" rx=".5" stroke-width="1" fill="currentColor" opacity="0.25"/>
        <line x1="2" y1="2" x2="12" y2="14" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
      wire: `<svg viewBox="0 0 14 18" width="14" height="18" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
        <path d="M3 7a4 4 0 0 1 8 0c0 2.2-1.5 3.8-2 5.5H5C4.5 10.8 3 9.2 3 7z"/>
        <rect x="5" y="13.5" width="4" height="1.5" rx=".5"/>
        <rect x="5.5" y="15.5" width="3" height="1" rx=".5"/>
      </svg>`,
    };

    const id = this.#editor.selectedEntityId;
    const scaleLocked = id !== null && this.#editor.isScaleLocked(id);

    const btn = (cls, icon, active, title, disabled = false) =>
      `<button class="vt-btn${active ? ' active' : ''}${disabled ? ' vt-btn-disabled' : ''}" data-action="${cls}" title="${title}"${disabled ? ' disabled' : ''}>${icon}</button>`;

    this.#el.innerHTML = `
      <div class="vt-group">
        ${btn('translate', ico.translate, mode === 'translate', 'Position [1]')}
        ${btn('rotate',    ico.rotate,    mode === 'rotate',    'Rotation [2]')}
        ${btn('scale',     ico.scale,     mode === 'scale',     'Scale [3]', scaleLocked)}
      </div>
      <div class="vt-group">
        ${btn('view-default',   ico.lit,   view === 'default',   'Lit [4]')}
        ${btn('view-unlit',     ico.unlit, view === 'unlit',     'Unlit [5]')}
        ${btn('view-wireframe', ico.wire,  view === 'wireframe', 'Wireframe [6]')}
      </div>
    `;

    this.#el.querySelectorAll('[data-action]').forEach(b => {
      b.addEventListener('click', () => {
        sfx.click();
        const a = b.dataset.action;
        if (a === 'translate' || a === 'rotate' || a === 'scale') {
          if (a === 'scale' && scaleLocked) return;
          this.#editor.setTransformMode(a);
        } else if (a === 'view-default') {
          this.#editor.setViewMode('default');
        } else if (a === 'view-unlit') {
          this.#editor.setViewMode('unlit');
        } else if (a === 'view-wireframe') {
          this.#editor.setViewMode('wireframe');
        }
      });
    });
  }
}
