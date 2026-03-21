import { showModal, showToast, showConfirm } from './utils.js';
import { sfx } from './sfx.js';

export class Dashboard {
  #el = null;
  #projectManager = null;
  #onOpen = null;
  #openGear = null;
  #docClick = () => {
    this.#closeGear();
    this.#closeMenus();
  };

  constructor(projectManager, onOpen) {
    this.#projectManager = projectManager;
    this.#onOpen = onOpen;
  }

  mount(parent) {
    this.#el = document.createElement('div');
    this.#el.className = 'dashboard';
    parent.appendChild(this.#el);

    // Apply persisted theme
    document.documentElement.dataset.theme = localStorage.getItem('editorTheme') ?? 'default';

    document.addEventListener('click', this.#docClick);
    this.#render();
  }

  destroy() {
    document.removeEventListener('click', this.#docClick);
    document.querySelectorAll('.project-card-gear-dropdown').forEach(el => el.remove());
    this.#el?.remove();
  }

  #closeGear() {
    if (this.#openGear) {
      this.#openGear.classList.remove('open');
      this.#openGear = null;
    }
  }

  #closeMenus() {
    this.#el?.querySelectorAll('.topbar-dropdown').forEach(d => d.classList.remove('open'));
  }

  #render() {
    const pm = this.#projectManager;
    const projects = pm.getProjects();

    this.#el.innerHTML = `
      <div class="db-topbar">
        <div class="db-topbar-menu" id="db-editor-btn-wrap">
          <img src="/brand.png" class="topbar-brand-logo" alt="Zod" />
          <button class="db-topbar-btn" id="db-editor-btn">Editor</button>
          <button class="db-topbar-btn" id="db-project-btn">Project</button>
        </div>
        <span class="db-topbar-title">Zod Engine</span>
        <div class="db-topbar-right"></div>
      </div>
      <div class="dashboard-body">
        <div class="dashboard-section-title">Projects</div>
        <div class="project-grid" id="project-grid"></div>
      </div>
    `;

    this.#buildEditorMenu();
    this.#buildProjectMenu();

    // Logo bounce + winner sound
    const logo = this.#el.querySelector('.topbar-brand-logo');
    if (logo) {
      logo.style.cursor = 'pointer';
      logo.addEventListener('click', () => {
        sfx.win();
        logo.classList.remove('logo-bounce');
        requestAnimationFrame(() => logo.classList.add('logo-bounce'));
      });
      logo.addEventListener('animationend', () => logo.classList.remove('logo-bounce'));
    }

    // Topbar button click sounds
    this.#el.querySelectorAll('.db-topbar-btn').forEach(btn => {
      btn.addEventListener('click', () => sfx.click(), { capture: true });
    });

    const grid = this.#el.querySelector('#project-grid');

    const newCard = document.createElement('div');
    newCard.className = 'project-new-card';
    newCard.innerHTML = '<div class="plus">+</div><div>New Project</div>';
    newCard.addEventListener('click', () => this.#createProject());
    grid.appendChild(newCard);

    const importCard = document.createElement('div');
    importCard.className = 'project-new-card';
    importCard.innerHTML = '<div class="plus">&#128229;</div><div>Import Project</div>';
    importCard.addEventListener('click', () => this.#importProject());
    grid.appendChild(importCard);

    projects.forEach((project, i) => {
      const card = this.#makeCard(project);
      card.style.animationDelay = `${0.05 + i * 0.06}s`;
      grid.insertBefore(card, newCard);
    });
    newCard.style.animationDelay = `${0.05 + projects.length * 0.06}s`;
    importCard.style.animationDelay = `${0.05 + (projects.length + 1) * 0.06}s`;
  }

  #makeCard(project) {
    const pm = this.#projectManager;
    const thumb = project.scenes?.find(s => s.thumbnail)?.thumbnail ?? null;
    const scenesCount = project.scenes?.length ?? 0;
    const dateStr = new Date(project.updatedAt ?? project.createdAt).toLocaleDateString();

    const card = document.createElement('div');
    card.className = 'project-card';

    const thumbEl = document.createElement('div');
    thumbEl.className = 'project-card-thumb';
    if (thumb) {
      thumbEl.innerHTML = `<img src="${thumb}" alt="preview" />`;
    } else {
      thumbEl.innerHTML = `<span class="project-card-no-thumb">&#128196;</span>`;
    }

    const gearWrap = document.createElement('div');
    gearWrap.className = 'project-card-gear-wrap';
    gearWrap.innerHTML = `<button class="project-card-gear" title="Options">&#9881;</button>`;

    const gearDropdown = document.createElement('div');
    gearDropdown.className = 'project-card-gear-dropdown';
    gearDropdown.innerHTML = `
      <div class="gear-item" data-action="rename">Rename</div>
      <div class="gear-item" data-action="export">Export</div>
      <div class="gear-item danger" data-action="delete">Delete</div>
    `;
    document.body.appendChild(gearDropdown);

    gearWrap.querySelector('.project-card-gear').addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = gearDropdown.classList.contains('open');
      this.#closeGear();
      if (!isOpen) {
        const rect = e.currentTarget.getBoundingClientRect();
        gearDropdown.style.top = (rect.bottom + 4) + 'px';
        gearDropdown.style.left = (rect.right - 130) + 'px';
        gearDropdown.classList.add('open');
        this.#openGear = gearDropdown;
      }
    });

    gearDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = e.target.dataset.action;
      this.#closeGear();
      if (action === 'rename') this.#renameProject(project.id);
      else if (action === 'export') this.#exportProject(project.id);
      else if (action === 'delete') this.#deleteProject(project.id);
    });

    thumbEl.appendChild(gearWrap);

    const nameEl = document.createElement('div');
    nameEl.className = 'project-card-name';
    nameEl.textContent = project.name;

    const metaEl = document.createElement('div');
    metaEl.className = 'project-card-meta';
    metaEl.innerHTML = `<span>${scenesCount} scene${scenesCount !== 1 ? 's' : ''}</span><span>${dateStr}</span>`;

    card.appendChild(thumbEl);
    card.appendChild(nameEl);
    card.appendChild(metaEl);

    card.addEventListener('click', (e) => {
      if (e.target.closest('.project-card-gear-wrap')) return;
      sfx.suck();
      this.#onOpen(project);
    });

    return card;
  }

  #buildEditorMenu() {
    const btn = this.#el.querySelector('#db-editor-btn');
    if (!btn) return;
    btn.style.position = 'relative';

    const dropdown = document.createElement('div');
    dropdown.className = 'topbar-dropdown';

    // Theme row
    const themeRow = document.createElement('div');
    themeRow.className = 'topbar-dropdown-item topbar-theme-row';
    themeRow.innerHTML = `<span>Theme</span>`;
    const themeSelect = document.createElement('select');
    themeSelect.className = 'topbar-theme-select';
    [
      ['default','Default'],['orange','Orange'],['green','Green'],
      ['blue','Blue'],['red','Red'],['purple','Purple'],['pink','Pink'],
      ['flat','Flat'],['flat-orange','Flat Orange'],['flat-green','Flat Green'],
      ['flat-blue','Flat Blue'],['flat-red','Flat Red'],['flat-purple','Flat Purple'],['flat-pink','Flat Pink'],
      ['light','Light'],['flat-light','Flat Light'],
    ].forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = label;
      if ((localStorage.getItem('editorTheme') ?? 'default') === val) opt.selected = true;
      themeSelect.appendChild(opt);
    });
    themeSelect.addEventListener('change', (e) => { e.stopPropagation(); sfx.check(); this.#applyTheme(themeSelect.value); });
    themeSelect.addEventListener('click', (e) => e.stopPropagation());
    themeRow.appendChild(themeSelect);
    dropdown.appendChild(themeRow);

    // Language
    const langItem = document.createElement('div');
    langItem.className = 'topbar-dropdown-item';
    langItem.textContent = 'Language';
    langItem.addEventListener('click', (e) => { e.stopPropagation(); showToast('Coming soon'); dropdown.classList.remove('open'); });
    dropdown.appendChild(langItem);

    // Shortcuts
    const shortItem = document.createElement('div');
    shortItem.className = 'topbar-dropdown-item';
    shortItem.textContent = 'Shortcuts';
    shortItem.addEventListener('click', (e) => { e.stopPropagation(); showToast('Coming soon'); dropdown.classList.remove('open'); });
    dropdown.appendChild(shortItem);

    // Sep + Exit
    const sep = document.createElement('div');
    sep.className = 'topbar-dropdown-sep';
    dropdown.appendChild(sep);

    const exitItem = document.createElement('div');
    exitItem.className = 'topbar-dropdown-item danger';
    exitItem.textContent = 'Exit';
    exitItem.addEventListener('click', async (e) => {
      e.stopPropagation();
      dropdown.classList.remove('open');
      const ok = await showConfirm('Exit', 'Close the application?', 'Exit');
      if (ok) { sfx.out(); window.close(); }
    });
    dropdown.appendChild(exitItem);

    dropdown.addEventListener('click', (e) => e.stopPropagation());
    btn.appendChild(dropdown);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');
      this.#closeMenus();
      if (!isOpen) dropdown.classList.add('open');
    });
  }

  #buildProjectMenu() {
    const btn = this.#el.querySelector('#db-project-btn');
    if (!btn) return;
    btn.style.position = 'relative';

    const dropdown = document.createElement('div');
    dropdown.className = 'topbar-dropdown';

    const newItem = document.createElement('div');
    newItem.className = 'topbar-dropdown-item';
    newItem.innerHTML = '&#10010; New Project';
    newItem.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.remove('open');
      this.#createProject();
    });
    dropdown.appendChild(newItem);

    const importItem = document.createElement('div');
    importItem.className = 'topbar-dropdown-item';
    importItem.innerHTML = '&#128229; Import Project';
    importItem.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.remove('open');
      this.#importProject();
    });
    dropdown.appendChild(importItem);

    dropdown.addEventListener('click', (e) => e.stopPropagation());
    btn.appendChild(dropdown);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');
      this.#closeMenus();
      if (!isOpen) dropdown.classList.add('open');
    });
  }

  #applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('editorTheme', theme);
  }

  async #createProject() {
    const name = await showModal('New Project', 'Project name:', 'My Project');
    if (!name) return;
    const project = this.#projectManager.createProject(name);
    sfx.check();
    showToast(`Project "${project.name}" created`, 'success');
    this.#render();
  }

  async #renameProject(id) {
    const project = this.#projectManager.getProject(id);
    if (!project) return;
    const name = await showModal('Rename Project', 'New name:', project.name);
    if (!name) return;
    this.#projectManager.renameProject(id, name);
    sfx.check();
    this.#render();
  }

  async #deleteProject(id) {
    const project = this.#projectManager.getProject(id);
    if (!project) return;
    const ok = await showConfirm('Delete Project', `Delete "${project.name}"? This cannot be undone.`, 'Delete');
    if (!ok) return;
    this.#projectManager.deleteProject(id);
    sfx.out();
    showToast('Project deleted');
    this.#render();
  }

  #exportProject(id) {
    const project = this.#projectManager.getProject(id);
    if (!project) return;
    const data = JSON.stringify(project, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}.ecs.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported: ${project.name}`, 'success');
  }

  #importProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.ecs.json';
    input.click();
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const project = this.#projectManager.importProject(text);
        sfx.check();
        showToast(`Imported: ${project.name}`, 'success');
        this.#render();
      } catch (e) {
        showToast('Failed to import: ' + e.message, 'error');
      }
    });
  }
}
