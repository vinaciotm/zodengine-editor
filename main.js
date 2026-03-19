import './src/style.css';
import { ProjectManager } from './src/editor/ProjectManager.js';
import { Dashboard } from './src/gui/Dashboard.js';
import { EditorLayout } from './src/gui/EditorLayout.js';
import { Editor } from './src/editor/Editor.js';

const app = document.getElementById('app');
const projectManager = new ProjectManager();
let currentLayout = null;

function showDashboard() {
  currentLayout?.destroy();
  currentLayout = null;
  const dashboard = new Dashboard(projectManager, openProject);
  dashboard.mount(app);
  currentLayout = dashboard;
}

async function openProject(project) {
  currentLayout?.destroy();
  currentLayout = null;
  const editor = new Editor(project);
  const layout = new EditorLayout(editor, projectManager, () => {
    layout.destroy();
    currentLayout = null;
    showDashboard();
  });
  layout.mount(app);
  currentLayout = layout;
}

showDashboard();
