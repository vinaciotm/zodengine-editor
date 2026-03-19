import { showModal } from './utils.js';

export class ScenesPanel {
  #el = null;
  #editor = null;
  #unsubs = [];

  constructor(editor) { this.#editor = editor; }

  mount(parent) {
    this.#el = document.createElement('div');
    this.#el.className = 'panel';
    this.#el.style.cssText = 'border-top:1px solid var(--border);max-height:200px;flex-shrink:0;';
    parent.appendChild(this.#el);
    this.#render();
    this.#unsubs.push(
      this.#editor.on('scenes:changed', () => this.#render()),
      this.#editor.on('scene:switched', () => this.#render()),
    );
  }

  destroy() {
    this.#unsubs.forEach(u => u());
    this.#el?.remove();
  }

  #render() {
    const scenes = this.#editor.project.scenes;
    const active = this.#editor.currentSceneIndex;

    this.#el.innerHTML = `
      <div class="panel-header">
        <span>&#127916; Scenes</span>
        <div class="panel-header-actions">
          <button class="btn-icon btn" id="scene-add" title="Add Scene">+</button>
        </div>
      </div>
      <div class="panel-content" id="scenes-list"></div>
    `;

    this.#el.querySelector('#scene-add').addEventListener('click', async () => {
      const name = await showModal('New Scene', 'Scene name:', 'New Scene');
      if (!name) return;
      const idx = this.#editor.addScene(name);
      this.#editor.switchScene(idx);
    });

    const list = this.#el.querySelector('#scenes-list');
    scenes.forEach((scene, idx) => {
      const item = document.createElement('div');
      item.className = 'scene-item' + (idx === active ? ' active' : '');
      item.innerHTML = `
        <span class="scene-item-icon">&#127916;</span>
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
