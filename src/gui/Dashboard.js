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
        <span>Game Engine Editor</span>
      </div>
      <div class="dashboard-body">
        <div class="dashboard-section-title">&#128193; Projects</div>
        <div class="project-grid" id="project-grid"></div>
      </div>
    `;

    const grid = this.#el.querySelector('#project-grid');

    // New project card
    const newCard = document.createElement('div');
    newCard.className = 'project-new-card';
    newCard.innerHTML = '<div class="plus">+</div><div>New Project</div>';
    newCard.addEventListener('click', () => this.#createProject());
    grid.appendChild(newCard);

    // Existing projects
    for (const project of projects) {
      const card = document.createElement('div');
      card.className = 'project-card';
      card.innerHTML = `
        <div class="project-card-name">${this.#esc(project.name)}</div>
        <div class="project-card-date">&#128197; ${new Date(project.createdAt).toLocaleDateString()}</div>
        <div class="project-card-scenes">&#127916; ${project.scenes?.length ?? 0} scene(s)</div>
        <div class="project-card-actions">
          <button class="btn btn-primary" data-open="${project.id}">Open</button>
          <button class="btn btn-secondary" data-rename="${project.id}">Rename</button>
          <button class="btn btn-danger" data-delete="${project.id}">&#128465;</button>
        </div>
      `;
      card.addEventListener('dblclick', () => this.#onOpen(project));
      card.addEventListener('click', (e) => {
        const openId = e.target.dataset.open;
        const renameId = e.target.dataset.rename;
        const deleteId = e.target.dataset.delete;
        if (openId) { e.stopPropagation(); this.#onOpen(pm.getProject(openId)); }
        else if (renameId) { e.stopPropagation(); this.#renameProject(renameId); }
        else if (deleteId) { e.stopPropagation(); this.#deleteProject(deleteId); }
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

  #esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
}
