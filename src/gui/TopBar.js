import { showModal, showToast } from './utils.js';

export class TopBar {
  #el = null;
  #editor = null;
  #projectManager = null;
  #onExit = null;
  #openMenu = null;

  constructor(editor, projectManager, onExit) {
    this.#editor = editor;
    this.#projectManager = projectManager;
    this.#onExit = onExit;
  }

  mount(parent) {
    this.#el = document.createElement('div');
    this.#el.className = 'editor-topbar';
    parent.appendChild(this.#el);
    this.#render();
    this.#wireEvents();
  }

  destroy() { this.#el?.remove(); }

  #render() {
    const name = this.#editor.project.name;
    this.#el.innerHTML = `
      <div class="topbar-menu">
        <button class="topbar-btn" data-menu="file">
          File
          <div class="topbar-dropdown" id="menu-file">
            <div class="topbar-dropdown-item" data-action="new-scene">New Scene</div>
            <div class="topbar-dropdown-sep"></div>
            <div class="topbar-dropdown-item" data-action="save">Save Project <span style="color:#666;font-size:11px">Ctrl+S</span></div>
            <div class="topbar-dropdown-sep"></div>
            <div class="topbar-dropdown-item danger" data-action="exit">Exit to Dashboard</div>
          </div>
        </button>
        <button class="topbar-btn" data-menu="scene">
          Scene
          <div class="topbar-dropdown" id="menu-scene">
            <div class="topbar-dropdown-item" data-action="rename-scene">Rename Scene</div>
            <div class="topbar-dropdown-item danger" data-action="delete-scene">Delete Scene</div>
          </div>
        </button>
      </div>
      <div class="topbar-title">${this.#esc(name)} &#8212; ${this.#currentSceneName()}</div>
      <div class="topbar-right">
        <span class="topbar-badge" id="save-badge">Unsaved</span>
      </div>
    `;
  }

  #currentSceneName() {
    const s = this.#editor.project.scenes[this.#editor.currentSceneIndex];
    return s ? this.#esc(s.name) : 'Scene';
  }

  #wireEvents() {
    // Menu open/close
    this.#el.querySelectorAll('[data-menu]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const menuId = 'menu-' + btn.dataset.menu;
        const dropdown = btn.querySelector('.topbar-dropdown');
        if (this.#openMenu && this.#openMenu !== dropdown) {
          this.#openMenu.classList.remove('open');
        }
        dropdown.classList.toggle('open');
        this.#openMenu = dropdown.classList.contains('open') ? dropdown : null;
      });
    });

    document.addEventListener('click', () => {
      this.#openMenu?.classList.remove('open');
      this.#openMenu = null;
    });

    // Actions
    this.#el.addEventListener('click', async (e) => {
      const item = e.target.closest('[data-action]');
      if (!item) return;
      e.stopPropagation();
      this.#closeMenus();
      switch (item.dataset.action) {
        case 'save': this.#save(); break;
        case 'exit': this.#exit(); break;
        case 'new-scene': await this.#newScene(); break;
        case 'rename-scene': await this.#renameScene(); break;
        case 'delete-scene': this.#deleteScene(); break;
      }
    });

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); this.#save(); }
    });

    // Listen for save event
    this.#editor.on('project:saved', () => {
      const badge = this.#el.querySelector('#save-badge');
      if (badge) { badge.textContent = 'Saved'; badge.style.color = 'var(--success)'; setTimeout(() => { if (badge) { badge.textContent = 'Unsaved'; badge.style.color = ''; } }, 2000); }
    });
    this.#editor.on('scene:switched', () => this.#render());
  }

  #save() {
    this.#editor.saveProject();
    this.#projectManager.saveProject(this.#editor.project);
    showToast('Project saved', 'success');
  }

  #exit() {
    if (!confirm('Exit to dashboard? Unsaved changes will be lost.')) return;
    this.#onExit();
  }

  async #newScene() {
    const name = await showModal('New Scene', 'Scene name:', 'New Scene');
    if (!name) return;
    const idx = this.#editor.addScene(name);
    this.#editor.switchScene(idx);
  }

  async #renameScene() {
    const current = this.#editor.project.scenes[this.#editor.currentSceneIndex];
    const name = await showModal('Rename Scene', 'Scene name:', current?.name ?? '');
    if (!name) return;
    this.#editor.renameScene(this.#editor.currentSceneIndex, name);
    this.#render();
  }

  #deleteScene() {
    const s = this.#editor.project.scenes[this.#editor.currentSceneIndex];
    if (!s) return;
    if (!confirm(`Delete scene "${s.name}"?`)) return;
    this.#editor.deleteScene(this.#editor.currentSceneIndex);
  }

  #closeMenus() {
    this.#el.querySelectorAll('.topbar-dropdown').forEach(d => d.classList.remove('open'));
    this.#openMenu = null;
  }

  #esc(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
}
