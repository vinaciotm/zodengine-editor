import { TopBar } from './TopBar.js';
import { HierarchyPanel } from './HierarchyPanel.js';
import { InspectorPanel } from './InspectorPanel.js';
import { PrefabsPanel } from './PrefabsPanel.js';
import { ScenesPanel } from './ScenesPanel.js';
import { TransformToolbar } from './TransformToolbar.js';

export class EditorLayout {
  #el = null;
  #editor = null;
  #projectManager = null;
  #onExit = null;
  #panels = [];

  constructor(editor, projectManager, onExit) {
    this.#editor = editor;
    this.#projectManager = projectManager;
    this.#onExit = onExit;
  }

  mount(parent) {
    this.#el = document.createElement('div');
    this.#el.className = 'editor-container';
    parent.appendChild(this.#el);
    this.#build();
  }

  async #build() {
    const editor = this.#editor;
    const el = this.#el;

    // Top bar
    const topBar = new TopBar(editor, this.#projectManager, this.#onExit);
    topBar.mount(el);
    this.#panels.push(topBar);

    // Body
    const body = document.createElement('div');
    body.className = 'editor-body';
    el.appendChild(body);

    // Left panel
    const left = document.createElement('div');
    left.className = 'editor-left';
    body.appendChild(left);

    const prefabs = new PrefabsPanel(editor);
    prefabs.mount(left);
    this.#panels.push(prefabs);

    const scenes = new ScenesPanel(editor);
    scenes.mount(left);
    this.#panels.push(scenes);

    // Center panel
    const center = document.createElement('div');
    center.className = 'editor-center';
    body.appendChild(center);

    const toolbar = new TransformToolbar(editor);
    toolbar.mount(center);
    this.#panels.push(toolbar);

    const viewport = document.createElement('div');
    viewport.className = 'viewport-wrapper';
    center.appendChild(viewport);

    // Initialize editor (creates renderer, attaches canvas)
    await editor.init(viewport);

    // Right panel
    const right = document.createElement('div');
    right.className = 'editor-right';
    body.appendChild(right);

    const hierarchy = new HierarchyPanel(editor);
    hierarchy.mount(right);
    this.#panels.push(hierarchy);

    const divider = document.createElement('div');
    divider.className = 'panel-divider';
    right.appendChild(divider);

    const inspector = new InspectorPanel(editor);
    inspector.mount(right);
    this.#panels.push(inspector);
  }

  destroy() {
    this.#panels.forEach(p => p.destroy?.());
    this.#editor.destroy();
    this.#el?.remove();
  }
}
