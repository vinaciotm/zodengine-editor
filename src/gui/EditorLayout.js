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

    // Body row (left-center + right)
    const body = document.createElement('div');
    body.className = 'editor-body';
    el.appendChild(body);

    // Left-center wrapper (column: main row only, no footer here)
    const leftCenter = document.createElement('div');
    leftCenter.className = 'editor-left-center';
    body.appendChild(leftCenter);

    const mainRow = document.createElement('div');
    mainRow.className = 'editor-main-row';
    leftCenter.appendChild(mainRow);

    // Left sidebar: Cenários (top, fixed height) + Objetos (flex:1)
    const left = document.createElement('div');
    left.className = 'editor-left';
    mainRow.appendChild(left);

    const scenesWrap = document.createElement('div');
    scenesWrap.className = 'left-scenes-wrap';
    left.appendChild(scenesWrap);

    const scenes = new ScenesPanel(editor);
    scenes.mount(scenesWrap);
    this.#panels.push(scenes);

    const hierarchy = new HierarchyPanel(editor);
    hierarchy.mount(left);
    this.#panels.push(hierarchy);

    // Cenários + Objetos collapse state → narrow mode
    let scenesOpen = true;
    let hierOpen = true;
    let rightOpen = true;

    // Center (viewport) — created before float bars
    const center = document.createElement('div');
    center.className = 'editor-center';
    mainRow.appendChild(center);

    const viewport = document.createElement('div');
    viewport.className = 'viewport-wrapper';
    viewport.style.position = 'relative';
    center.appendChild(viewport);

    // Floating panel re-open buttons (overlaid on viewport edges)
    const leftFloat = document.createElement('div');
    leftFloat.className = 'panel-float-bar panel-float-left';
    leftFloat.style.display = 'none';
    center.appendChild(leftFloat);

    const rightFloat = document.createElement('div');
    rightFloat.className = 'panel-float-bar panel-float-right';
    rightFloat.style.display = 'none';
    center.appendChild(rightFloat);

    const makeFloatBtn = (icon, title) => {
      const btn = document.createElement('button');
      btn.className = 'panel-float-btn';
      btn.innerHTML = icon;
      btn.title = title;
      return btn;
    };
    const scenesFloatBtn = makeFloatBtn('🎬', 'Cenários');
    const hierFloatBtn = makeFloatBtn('🔗', 'Objetos');
    leftFloat.appendChild(scenesFloatBtn);
    leftFloat.appendChild(hierFloatBtn);

    const rightFloatBtn = makeFloatBtn('📄', 'Detalhes');
    rightFloat.appendChild(rightFloatBtn);

    const updateLeftNarrow = () => {
      const isNarrow = !scenesOpen && !hierOpen;
      left.classList.toggle('narrow', isNarrow);
      leftFloat.style.display = isNarrow ? 'flex' : 'none';
    };

    const updateRightNarrow = () => {
      right.classList.toggle('narrow', !rightOpen);
      rightFloat.style.display = rightOpen ? 'none' : 'flex';
    };

    // Hook Cenários header: track state + narrow
    const scenesHeader = scenesWrap.querySelector('.panel-header');
    scenesHeader?.addEventListener('click', (e) => {
      if (e.target.closest('.panel-header-actions')) return;
      const content = scenesWrap.querySelector('.panel-content');
      scenesOpen = !content || content.style.display !== 'none';
      updateLeftNarrow();
    });

    // Hook Objetos header: narrow mode only
    const allHeaders = left.querySelectorAll('.panel-header');
    const hierHeader = [...allHeaders].find(h => !scenesWrap.contains(h));
    hierHeader?.addEventListener('click', (e) => {
      if (e.target.closest('.panel-header-actions')) return;
      const panel = [...left.children].find(el => el !== scenesWrap);
      const content = panel?.querySelector('.panel-content');
      hierOpen = !content || content.style.display !== 'none';
      updateLeftNarrow();
    });

    // Float buttons expand their panel
    scenesFloatBtn.addEventListener('click', () => scenesHeader?.click());
    hierFloatBtn.addEventListener('click', () => hierHeader?.click());

    const toolbar = new TransformToolbar(editor);
    toolbar.mount(viewport);
    this.#panels.push(toolbar);

    const groupBar = new GroupActionBar(editor);
    groupBar.mount(viewport);
    this.#panels.push(groupBar);

    await editor.init(viewport);

    editor.on('notification', msg => showToast(msg, 'error'));

    // Footer: under left+center only (Assets), inside leftCenter
    const footer = document.createElement('div');
    footer.className = 'editor-footer';
    leftCenter.appendChild(footer);

    const assetsWrap = document.createElement('div');
    assetsWrap.className = 'editor-footer-assets';
    footer.appendChild(assetsWrap);

    const prefabs = new PrefabsPanel(editor);
    prefabs.mount(assetsWrap);
    this.#panels.push(prefabs);

    // Right: Detalhes (full height sibling of leftCenter)
    const right = document.createElement('div');
    right.className = 'editor-right';
    body.appendChild(right);

    const inspector = new InspectorPanel(editor);
    inspector.mount(right);
    this.#panels.push(inspector);

    // Detalhes narrow mode on collapse
    right.addEventListener('click', (e) => {
      if (!e.target.closest('.panel-header')) return;
      if (e.target.closest('.panel-header-actions')) return;
      const content = right.querySelector('#insp-content');
      if (!content) return;
      rightOpen = content.style.display !== 'none';
      updateRightNarrow();
    });

    // Right float button expands Detalhes
    rightFloatBtn.addEventListener('click', () => {
      right.querySelector('.panel-header')?.click();
    });
  }

  async #startRuntime() {
    this.#editor.saveCurrentScene();
    const sceneData = this.#editor.project.scenes[this.#editor.currentSceneIndex];
    this.#editor.isPlaying = true;
    this.#runtime = new Runtime(() => { this.#runtime = null; this.#editor.isPlaying = false; });
    await this.#runtime.start(sceneData);
  }

  destroy() {
    this.#runtime?.stop();
    this.#panels.forEach(p => p.destroy?.());
    this.#editor.destroy();
    this.#el?.remove();
  }
}
