import { TopBar } from './TopBar.js';
import { HierarchyPanel } from './HierarchyPanel.js';
import { InspectorPanel } from './InspectorPanel.js';
import { PrefabsPanel } from './PrefabsPanel.js';
import { ScenesPanel } from './ScenesPanel.js';
import { TransformToolbar } from './TransformToolbar.js';
import { GroupActionBar } from './GroupActionBar.js';
import { Runtime } from '../runtime/Runtime.js';

export class EditorLayout {
  #el = null;
  #editor = null;
  #projectManager = null;
  #onExit = null;
  #panels = [];
  #runtime = null;

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

    const onRuntime = () => this.#startRuntime();

    const topBar = new TopBar(editor, this.#projectManager, this.#onExit, onRuntime);
    topBar.mount(el);
    this.#panels.push(topBar);

    const body = document.createElement('div');
    body.className = 'editor-body';
    el.appendChild(body);

    const left = document.createElement('div');
    left.className = 'editor-left';
    body.appendChild(left);

    const prefabs = new PrefabsPanel(editor);
    prefabs.mount(left);
    this.#panels.push(prefabs);

    const scenes = new ScenesPanel(editor);
    scenes.mount(left);
    this.#panels.push(scenes);

    const center = document.createElement('div');
    center.className = 'editor-center';
    body.appendChild(center);

    const toolbar = new TransformToolbar(editor);
    toolbar.mount(center);
    this.#panels.push(toolbar);

    const viewport = document.createElement('div');
    viewport.className = 'viewport-wrapper';
    viewport.style.position = 'relative';
    center.appendChild(viewport);

    // Group action bar overlay above viewport
    const groupBar = new GroupActionBar(editor);
    groupBar.mount(viewport);
    this.#panels.push(groupBar);

    await editor.init(viewport);

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

  async #startRuntime() {
    this.#editor.saveCurrentScene();
    const sceneData = this.#editor.project.scenes[this.#editor.currentSceneIndex];
    this.#runtime = new Runtime(() => { this.#runtime = null; });
    await this.#runtime.start(sceneData);
  }

  destroy() {
    this.#runtime?.stop();
    this.#panels.forEach(p => p.destroy?.());
    this.#editor.destroy();
    this.#el?.remove();
  }
}
