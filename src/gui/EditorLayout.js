import { TopBar } from './TopBar.js';
import { HierarchyPanel } from './HierarchyPanel.js';
import { InspectorPanel } from './InspectorPanel.js';
import { PrefabsPanel } from './PrefabsPanel.js';
import { ScenesPanel } from './ScenesPanel.js';
import { TransformToolbar } from './TransformToolbar.js';
import { GroupActionBar } from './GroupActionBar.js';
import { Runtime } from '../runtime/Runtime.js';
import { showToast } from './utils.js';

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

    // Left-center wrapper (column: main row + footer)
    const leftCenter = document.createElement('div');
    leftCenter.className = 'editor-left-center';
    body.appendChild(leftCenter);

    const mainRow = document.createElement('div');
    mainRow.className = 'editor-main-row';
    leftCenter.appendChild(mainRow);

    const left = document.createElement('div');
    left.className = 'editor-left';
    mainRow.appendChild(left);

    const hierarchy = new HierarchyPanel(editor);
    hierarchy.mount(left);
    this.#panels.push(hierarchy);

    const center = document.createElement('div');
    center.className = 'editor-center';
    mainRow.appendChild(center);

    const viewport = document.createElement('div');
    viewport.className = 'viewport-wrapper';
    viewport.style.position = 'relative';
    center.appendChild(viewport);

    const toolbar = new TransformToolbar(editor);
    toolbar.mount(viewport);
    this.#panels.push(toolbar);

    const groupBar = new GroupActionBar(editor);
    groupBar.mount(viewport);
    this.#panels.push(groupBar);

    await editor.init(viewport);

    editor.on('notification', msg => showToast(msg, 'error'));

    // Footer: Cenários (left) + Assets (rest)
    const footer = document.createElement('div');
    footer.className = 'editor-footer';
    leftCenter.appendChild(footer);

    const scenesWrap = document.createElement('div');
    scenesWrap.className = 'editor-footer-scenes';
    footer.appendChild(scenesWrap);

    const scenes = new ScenesPanel(editor);
    scenes.mount(scenesWrap);
    this.#panels.push(scenes);

    const assetsWrap = document.createElement('div');
    assetsWrap.className = 'editor-footer-assets';
    footer.appendChild(assetsWrap);

    const prefabs = new PrefabsPanel(editor);
    prefabs.mount(assetsWrap);
    this.#panels.push(prefabs);

    // Right: Detalhes
    const right = document.createElement('div');
    right.className = 'editor-right';
    body.appendChild(right);

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
