import './src/style.css';
import { ProjectManager } from './src/editor/ProjectManager.js';
import { Dashboard } from './src/gui/Dashboard.js';
import { EditorLayout } from './src/gui/EditorLayout.js';
import { Editor } from './src/editor/Editor.js';
import { showReloadDialog } from './src/gui/utils.js';

const app = document.getElementById('app');
const projectManager = new ProjectManager();
let currentLayout = null;
let currentEditor = null;

function showDashboard() {
  currentLayout?.destroy();
  currentLayout = null;
  currentEditor = null;
  const dashboard = new Dashboard(projectManager, openProject);
  dashboard.mount(app);
  currentLayout = dashboard;
}

async function openProject(project) {
  currentLayout?.destroy();
  currentLayout = null;
  currentEditor = null;
  const editor = new Editor(project);
  currentEditor = editor;
  const layout = new EditorLayout(editor, projectManager, () => {
    layout.destroy();
    currentLayout = null;
    currentEditor = null;
    showDashboard();
  });
  layout.mount(app);
  currentLayout = layout;
}

// Intercept F5 / Ctrl+R to show save-before-reload dialog
document.addEventListener('keydown', async (e) => {
  const isReload = e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R'));
  if (!isReload) return;
  e.preventDefault();
  e.stopPropagation();

  if (!currentEditor) { window.location.reload(); return; }

  const choice = await showReloadDialog();
  if (choice === 'cancel') return;
  if (choice === 'save') {
    currentEditor.saveProject();
    projectManager.saveProject(currentEditor.project);
  }
  window.location.reload();
}, { capture: true });

showDashboard();
