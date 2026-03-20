import { showNewSceneModal, makeCollapsiblePanel } from './utils.js';

export class ScenesPanel {
  #el = null;
  #editor = null;
  #unsubs = [];
  #listEl = null;

  constructor(editor) { this.#editor = editor; }

  mount(parent) {
    this.#el = document.createElement('div');
    this.#el.className = 'panel';
    this.#el.style.cssText = 'flex-shrink:0;border-top:1px solid var(--border);';
    parent.appendChild(this.#el);

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `
      <span>&#127916; Scenes</span>
      <div class="panel-header-actions">
        <button class="btn-icon btn" id="scene-add" title="Add Scene">+</button>
      </div>
    `;
    this.#el.appendChild(header);

    this.#listEl = document.createElement('div');
    this.#listEl.className = 'panel-content';
    this.#listEl.id = 'scenes-list';
    this.#el.appendChild(this.#listEl);

    makeCollapsiblePanel(header, this.#listEl, true);

    header.querySelector('#scene-add').addEventListener('click', async () => {
      const result = await showNewSceneModal();
      if (!result) return;
      const idx = this.#editor.addScene(result.name, result.copy);
      this.#editor.switchScene(idx);
    });

    this.#render();
    this.#unsubs.push(
      this.#editor.on('scenes:changed', () => this.#render()),
      this.#editor.on('scene:switched', () => this.#render()),
      this.#editor.on('scene:saved', () => this.#render()),
    );
  }

  destroy() {
    this.#unsubs.forEach(u => u());
    this.#el?.remove();
  }

  #render() {
    const scenes = this.#editor.project.scenes;
    const active = this.#editor.currentSceneIndex;
    const list = this.#listEl;
    if (!list) return;

    list.innerHTML = '';
    scenes.forEach((scene, idx) => {
      const item = document.createElement('div');
      item.className = 'scene-item' + (idx === active ? ' active' : '');

      const thumb = scene.thumbnail
        ? `<img src="${scene.thumbnail}" class="scene-thumb" />`
        : `<span class="scene-item-icon">&#127916;</span>`;

      item.innerHTML = `
        ${thumb}
        <span class="scene-item-name" title="${this.#esc(scene.name)}">${this.#esc(scene.name)}</span>
        ${scenes.length > 1 ? `<span class="scene-item-del" title="Delete">&#215;</span>` : ''}
      `;
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('scene-item-del')) {
          if (!confirm(`Delete scene "${scene.name}"?`)) return;
          this.#editor.deleteScene(idx);
          return;
        }
        if (idx !== active) this.#editor.switchScene(idx);
      });
      list.appendChild(item);
    });
  }

  #esc(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
}
