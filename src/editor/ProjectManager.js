const STORAGE_KEY = 'ecs_editor_projects';

function uuid() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export class ProjectManager {
  getProjects() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
    catch { return []; }
  }

  #save(projects) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }

  createProject(name) {
    const projects = this.getProjects();
    const project = {
      id: uuid(),
      name,
      createdAt: new Date().toISOString(),
      scenes: [{ id: uuid(), name: 'Main Scene', worldData: null }],
      currentSceneIndex: 0,
    };
    projects.push(project);
    this.#save(projects);
    return project;
  }

  getProject(id) {
    return this.getProjects().find(p => p.id === id) ?? null;
  }

  saveProject(project) {
    const projects = this.getProjects();
    const idx = projects.findIndex(p => p.id === project.id);
    if (idx >= 0) projects[idx] = project;
    else projects.push(project);
    this.#save(projects);
  }

  deleteProject(id) {
    const projects = this.getProjects().filter(p => p.id !== id);
    this.#save(projects);
  }

  renameProject(id, name) {
    const projects = this.getProjects();
    const p = projects.find(p => p.id === id);
    if (p) { p.name = name; this.#save(projects); }
  }

  duplicateProject(id) {
    const projects = this.getProjects();
    const src = projects.find(p => p.id === id);
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = uuid();
    copy.name = src.name + ' Copy';
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = new Date().toISOString();
    projects.push(copy);
    this.#save(projects);
    return copy;
  }

  importProject(jsonString) {
    const project = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    if (!project.id || !project.scenes) throw new Error('Invalid project format');
    this.saveProject(project);
    return project;
  }

  exportProjectJSON(project) {
    return JSON.stringify(project, null, 2);
  }
}
