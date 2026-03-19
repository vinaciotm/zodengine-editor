import { showModal, showToast } from './utils.js';

export class Dashboard {
  #el = null;
  #projectManager = null;
  #onOpen = null;

  constructor(projectManager, onOpen) {
    this.#projectManager = projectManager;
    this.#onOpen = onOpen;
  }

  mount(parent) {
    this.#el = document.createElement('div');
    this.#el.className = 'dashboard';
    parent.appendChild(this.#el);
    this.#render();
  }

  destroy() { this.#el?.remove(); }

  #render() {
    const pm = this.#projectManager;
    const projects = pm.getProjects();

    this.#el.innerHTML = `
      <div class="dashboard-header">
        <h1>&#9650; Three.js ECS Editor</h1>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-secondary" id="btn-import">&#128229; Import Project</button>
          <span style="color:var(--text-dim);font-size:12px;">Game Engine Editor</span>
        </div>
      </div>
      <div class="dashboard-body">
        <div class="dashboard-section-title">&#128193; Projects</div>
        <div class="project-grid" id="project-grid"></div>
      </div>
    `;

    this.#el.querySelector('#btn-import').addEventListener('click', () => this.#importProject());

    const grid = this.#el.querySelector('#project-grid');

    const newCard = document.createElement('div');
    newCard.className = 'project-new-card';
    newCard.innerHTML = '<div class="plus">+</div><div>New Project</div>';
    newCard.addEventListener('click', () => this.#createProject());
    grid.appendChild(newCard);

    for (const project of projects) {
      const card = document.createElement('div');
      card.className = 'project-card';
      // Find the most recent scene thumbnail
      const thumb = project.scenes?.find(s => s.thumbnail)?.thumbnail ?? null;
      const thumbHtml = thumb ? `<img class="project-card-thumb" src="${thumb}" alt="preview" />` : '';
      card.innerHTML = `
        ${thumbHtml}
        <div class="project-card-name">${this.#esc(project.name)}</div>
        <div class="project-card-date">&#128197; ${new Date(project.createdAt).toLocaleDateString()}</div>
        <div class="project-card-scenes">&#127916; ${project.scenes?.length ?? 0} scene(s)</div>
        <div class="project-card-actions">
          <button class="btn btn-primary" data-open="${project.id}">Open</button>
          <button class="btn btn-secondary" data-rename="${project.id}">Rename</button>
          <button class="btn btn-secondary" data-export="${project.id}">Export</button>
          <button class="btn btn-danger" data-delete="${project.id}">&#128465;</button>
        </div>
      `;
      card.addEventListener('dblclick', () => this.#onOpen(project));
      card.addEventListener('click', (e) => {
        const openId = e.target.dataset.open;
        const renameId = e.target.dataset.rename;
        const deleteId = e.target.dataset.delete;
        const exportId = e.target.dataset.export;
        if (openId) { e.stopPropagation(); this.#onOpen(pm.getProject(openId)); }
        else if (renameId) { e.stopPropagation(); this.#renameProject(renameId); }
        else if (deleteId) { e.stopPropagation(); this.#deleteProject(deleteId); }
        else if (exportId) { e.stopPropagation(); this.#exportProject(exportId); }
      });
      grid.insertBefore(card, newCard);
    }
  }

  async #createProject() {
    const name = await showModal('New Project', 'Project name:', 'My Project');
    if (!name) return;
    const project = this.#projectManager.createProject(name);
    showToast(`Project "${project.name}" created`, 'success');
    this.#render();
  }

  async #renameProject(id) {
    const project = this.#projectManager.getProject(id);
    if (!project) return;
    const name = await showModal('Rename Project', 'New name:', project.name);
    if (!name) return;
    this.#projectManager.renameProject(id, name);
    this.#render();
  }

  #deleteProject(id) {
    const project = this.#projectManager.getProject(id);
    if (!project) return;
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
    this.#projectManager.deleteProject(id);
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
        showToast(`Imported: ${project.name}`, 'success');
        this.#render();
      } catch (e) {
        alert('Failed to import: ' + e.message);
      }
    });
  }

  #esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
}
