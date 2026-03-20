import { showModal, showNewSceneModal, showToast, showConfirm } from './utils.js';
import { sfx } from './sfx.js';

export class TopBar {
  #el = null;
  #editor = null;
  #projectManager = null;
  #onExit = null;
  #openMenu = null;
  #onRuntime = null;

  #docClickHandler = () => { this.#closeMenus(); };
  #keyHandler = (e) => {
    const tag = e.target.tagName;
    const inInput = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); this.#save(); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
      e.preventDefault(); this.#editor.commandManager.redo(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault(); this.#editor.commandManager.undo(); return;
    }
    if (!inInput && (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'd') {
      e.preventDefault();
      if (this.#editor.selectedEntityId !== null) this.#editor.duplicateEntity(this.#editor.selectedEntityId);
      return;
    }
    if (!inInput && (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'c') {
      this.#editor.copyEntity?.();
      return;
    }
    if (!inInput && (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'v') {
      e.preventDefault();
      this.#editor.pasteEntity?.();
      return;
    }
    if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey) {
      const tag = e.target.tagName;
      if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        this.#onRuntime?.();
      }
    }
  };

  constructor(editor, projectManager, onExit, onRuntime) {
    this.#editor = editor;
    this.#projectManager = projectManager;
    this.#onExit = onExit;
    this.#onRuntime = onRuntime;
  }

  mount(parent) {
    this.#el = document.createElement('div');
    this.#el.className = 'editor-topbar';
    parent.appendChild(this.#el);
    // Apply persisted theme
    document.documentElement.dataset.theme = localStorage.getItem('editorTheme') ?? 'default';
    this.#render();
    document.addEventListener('keydown', this.#keyHandler);
    document.addEventListener('click', this.#docClickHandler);
  }

  destroy() {
    document.removeEventListener('keydown', this.#keyHandler);
    document.removeEventListener('click', this.#docClickHandler);
    this.#el?.remove();
  }

  #render() {
    const name = this.#editor.project.name;
    this.#el.innerHTML = `
      <div class="topbar-menu" id="topbar-menu">
        <img src="/brand.png" class="topbar-brand-logo" alt="Zod" />
        <button class="topbar-btn" id="tbtn-editor">Editor</button>
        <button class="topbar-btn" id="tbtn-project">Project</button>
        <button class="topbar-btn" id="tbtn-scene">Scene</button>
      </div>
      <div class="topbar-center">
        <button class="topbar-btn topbar-play-btn" id="tbtn-play" title="Play [P]">&#9654; Play</button>
      </div>
      <div class="topbar-right">
        <span class="topbar-info">${this.#esc(name)} &mdash; ${this.#esc(this.#currentSceneName())}</span>
        <span class="topbar-badge" id="save-badge">Unsaved</span>
      </div>
    `;

    this.#buildEditorMenu();
    this.#buildProjectMenu();
    this.#buildSceneMenu();

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

    // Menu button click sounds
    ['tbtn-editor', 'tbtn-project', 'tbtn-scene'].forEach(id => {
      this.#el.querySelector('#' + id)?.addEventListener('click', () => sfx.click(), { capture: true });
    });

    this.#el.querySelector('#tbtn-play').addEventListener('click', (e) => {
      e.stopPropagation();
      this.#onRuntime?.();
    });

    this.#editor.on('project:saved', () => {
      const badge = this.#el?.querySelector('#save-badge');
      if (badge) {
        badge.textContent = 'Saved'; badge.style.color = 'var(--success)';
        setTimeout(() => { if (badge) { badge.textContent = 'Unsaved'; badge.style.color = ''; } }, 2000);
      }
    });
    this.#editor.on('scene:switched', () => this.#refreshTitle());
    this.#editor.on('scenes:changed', () => this.#rebuildSceneMenu());
  }

  #buildEditorMenu() {
    const btn = this.#el.querySelector('#tbtn-editor');
    if (!btn) return;
    btn.style.position = 'relative';
    const dropdown = document.createElement('div');
    dropdown.className = 'topbar-dropdown';

    // Theme select row
    const themeRow = document.createElement('div');
    themeRow.className = 'topbar-dropdown-item topbar-theme-row';
    themeRow.innerHTML = `<span>Theme</span>`;
    const themeSelect = document.createElement('select');
    themeSelect.className = 'topbar-theme-select';
    [['default', 'Default'], ['flat', 'Flat']].forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = label;
      if ((localStorage.getItem('editorTheme') ?? 'default') === val) opt.selected = true;
      themeSelect.appendChild(opt);
    });
    themeSelect.addEventListener('change', (e) => { e.stopPropagation(); this.#applyTheme(themeSelect.value); });
    themeSelect.addEventListener('click', (e) => e.stopPropagation());
    themeRow.appendChild(themeSelect);
    dropdown.appendChild(themeRow);

    dropdown.appendChild(this.#makeSep());
    dropdown.appendChild(this.#makeItem('Language', 'editor-language'));
    dropdown.appendChild(this.#makeItem('Shortcuts', 'editor-shortcuts'));
    dropdown.appendChild(this.#makeSep());
    dropdown.appendChild(this.#makeItem('Exit to Dashboard', 'exit', true));

    btn.appendChild(dropdown);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');
      this.#closeMenus();
      if (!isOpen) { dropdown.classList.add('open'); this.#openMenu = dropdown; }
    });
  }

  #applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('editorTheme', theme);
    sfx.check();
  }

  #buildSceneMenu() {
    const btn = this.#el.querySelector('#tbtn-scene');
    if (!btn) return;
    btn.style.position = 'relative';

    const buildDropdown = () => {
      const dropdown = document.createElement('div');
      dropdown.className = 'topbar-dropdown';
      dropdown.id = 'dropdown-scene';

      const staticTop = [
        { label: '&#10010; New Scene', action: 'new-scene' },
        { label: 'Save Scene <kbd style="font-size:10px;opacity:0.6">Ctrl+S</kbd>', action: 'save' },
        { sep: true },
      ];
      for (const item of staticTop) {
        if (item.sep) { dropdown.appendChild(this.#makeSep()); continue; }
        dropdown.appendChild(this.#makeItem(item.label, item.action));
      }

      // Dynamic scene list
      const scenes = this.#editor.project.scenes;
      const active = this.#editor.currentSceneIndex;
      for (let i = 0; i < scenes.length; i++) {
        const isActive = i === active;
        const item = document.createElement('div');
        item.className = 'topbar-dropdown-item' + (isActive ? ' scene-active' : '');
        item.style.cssText = 'display:flex;align-items:center;';
        item.innerHTML = `${this.#esc(scenes[i].name)}<span style="margin-left:auto;padding-left:8px;color:var(--accent)">${isActive ? '&#10003;' : ''}</span>`;
        const idx = i;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          this.#closeMenus();
          if (idx !== this.#editor.currentSceneIndex) this.#editor.switchScene(idx);
        });
        dropdown.appendChild(item);
      }

      const staticBottom = [
        { sep: true },
        { label: 'Rename Scene', action: 'rename-scene' },
        { label: 'Delete Scene', action: 'delete-scene', danger: true },
      ];
      for (const item of staticBottom) {
        if (item.sep) { dropdown.appendChild(this.#makeSep()); continue; }
        dropdown.appendChild(this.#makeItem(item.label, item.action, item.danger));
      }

      return dropdown;
    };

    let dropdown = buildDropdown();
    btn.appendChild(dropdown);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');
      this.#closeMenus();
      if (!isOpen) { dropdown.classList.add('open'); this.#openMenu = dropdown; }
    });

    // Store rebuild function for later
    btn._rebuildDropdown = () => {
      dropdown.remove();
      dropdown = buildDropdown();
      btn.appendChild(dropdown);
    };
  }

  #rebuildSceneMenu() {
    const btn = this.#el?.querySelector('#tbtn-scene');
    btn?._rebuildDropdown?.();
    this.#refreshTitle();
  }

  #buildProjectMenu() {
    this.#buildDropdown('tbtn-project', [
      { label: '&#10010; New Project', action: 'new-project' },
      { label: 'Save Project', action: 'save-project' },
      { sep: true },
      { label: 'Export Project (.json)', action: 'export-project' },
      { label: '&#127918; Export Game (HTML)', action: 'export-game' },
      { sep: true },
      { label: '&#9881; Project Settings', action: 'settings' },
    ]);
  }

  #makeItem(label, action, danger = false) {
    const el = document.createElement('div');
    el.className = 'topbar-dropdown-item' + (danger ? ' danger' : '');
    el.innerHTML = label;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#closeMenus();
      this.#handleAction(action);
    });
    return el;
  }

  #makeSep() {
    const sep = document.createElement('div');
    sep.className = 'topbar-dropdown-sep';
    return sep;
  }

  #buildDropdown(btnId, items) {
    const btn = this.#el.querySelector('#' + btnId);
    if (!btn) return;
    btn.style.position = 'relative';
    const dropdown = document.createElement('div');
    dropdown.className = 'topbar-dropdown';
    for (const item of items) {
      if (item.sep) { dropdown.appendChild(this.#makeSep()); continue; }
      dropdown.appendChild(this.#makeItem(item.label, item.action, item.danger));
    }
    btn.appendChild(dropdown);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');
      this.#closeMenus();
      if (!isOpen) { dropdown.classList.add('open'); this.#openMenu = dropdown; }
    });
  }

  async #handleAction(action) {
    switch (action) {
      case 'save': this.#save(); break;
      case 'new-scene': await this.#newScene(); break;
      case 'rename-scene': await this.#renameScene(); break;
      case 'delete-scene': this.#deleteScene(); break;
      case 'new-project': await this.#newProject(); break;
      case 'save-project': this.#saveProject(); break;
      case 'export-project': this.#exportProject(); break;
      case 'export-game': this.#exportGame(); break;
      case 'editor-language':
      case 'editor-shortcuts':
      case 'settings': showToast('Coming soon'); break;
      case 'exit': this.#exit(); break;
    }
  }

  #save() {
    this.#editor.saveProject();
    this.#projectManager.saveProject(this.#editor.project);
    sfx.save();
    showToast('Scene saved', 'success');
  }

  #saveProject() {
    this.#editor.saveProject();
    this.#projectManager.saveProject(this.#editor.project);
    sfx.save();
    showToast('Project saved', 'success');
  }

  async #exit() {
    const ok = await showConfirm('Exit to Dashboard', 'Unsaved changes will be lost.', 'Exit');
    if (!ok) return;
    sfx.out();
    this.#onExit();
  }

  async #newScene() {
    const result = await showNewSceneModal();
    if (!result) return;
    const idx = this.#editor.addScene(result.name, result.copy);
    sfx.check();
    this.#editor.switchScene(idx);
  }

  async #renameScene() {
    const current = this.#editor.project.scenes[this.#editor.currentSceneIndex];
    const name = await showModal('Rename Scene', 'Scene name:', current?.name ?? '');
    if (!name) return;
    this.#editor.renameScene(this.#editor.currentSceneIndex, name);
    this.#refreshTitle();
    this.#rebuildSceneMenu();
  }

  async #deleteScene() {
    const s = this.#editor.project.scenes[this.#editor.currentSceneIndex];
    if (!s) return;
    const ok = await showConfirm('Delete Scene', `Delete "${s.name}"? This cannot be undone.`, 'Delete');
    if (!ok) return;
    sfx.out();
    this.#editor.deleteScene(this.#editor.currentSceneIndex);
  }

  async #newProject() {
    const name = await showModal('New Project', 'Project name:', 'My Project');
    if (!name) return;
    const project = this.#projectManager.createProject(name);
    showToast(`Project "${project.name}" created — open from dashboard`, 'success');
  }

  #exportProject() {
    this.#editor.saveProject();
    const data = JSON.stringify(this.#editor.project, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.#editor.project.name.replace(/\s+/g, '_')}.ecs.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Project exported', 'success');
  }

  #exportGame() {
    this.#editor.saveProject();
    const project = this.#editor.project;
    const sceneIdx = project.currentSceneIndex ?? 0;
    const sceneName = project.scenes[sceneIdx]?.name ?? 'Scene';
    const gameDataJson = JSON.stringify(project);

    const runtimeCode = `
(async () => {
  const GAME_DATA = ${gameDataJson};
  const sceneIdx = GAME_DATA.currentSceneIndex ?? 0;
  const sceneData = GAME_DATA.scenes[sceneIdx];

  const scene = new THREE.Scene();
  if (sceneData?.background) scene.background = new THREE.Color(sceneData.background);
  else scene.background = new THREE.Color(0x111111);

  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
  camera.position.set(0, 2, 5);

  const renderer = new THREE.WebGPURenderer({ antialias: true });
  await renderer.init();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  if (sceneData?.worldData) loadScene(sceneData.worldData);

  function makeMeshMat(mc) {
    const base = { color: mc.color };
    let mat;
    switch (mc.materialType ?? 'standard') {
      case 'phong':   mat = new THREE.MeshPhongMaterial({ ...base, shininess: mc.shininess ?? 30 }); break;
      case 'lambert': mat = new THREE.MeshLambertMaterial(base); break;
      case 'basic':   mat = new THREE.MeshBasicMaterial(base); break;
      case 'toon':    mat = new THREE.MeshToonMaterial(base); break;
      default:        mat = new THREE.MeshStandardMaterial({ ...base, roughness: mc.roughness ?? 0.5, metalness: mc.metalness ?? 0 });
    }
    if ((mc.opacity ?? 1) < 1) { mat.transparent = true; mat.opacity = mc.opacity; }
    if (mc.wireframe) mat.wireframe = true;
    return mat;
  }

  function loadScene(worldData) {
    const objs = new Map();
    for (const { id, components: c } of worldData.entities) {
      let obj = null;
      if ('GroupComponent' in c) {
        obj = new THREE.Group();
      } else if (c.MeshComponent) {
        const geoFn = {
          box: () => new THREE.BoxGeometry(1,1,1),
          sphere: () => new THREE.SphereGeometry(0.5,32,32),
          cone: () => new THREE.ConeGeometry(0.5,1,32),
          cylinder: () => new THREE.CylinderGeometry(0.5,0.5,1,32),
          capsule: () => new THREE.CapsuleGeometry(0.3,0.6,4,16),
          plane: () => new THREE.PlaneGeometry(1,1),
        };
        const geo = (geoFn[c.MeshComponent.type] ?? geoFn.box)();
        const mat = makeMeshMat(c.MeshComponent);
        obj = new THREE.Mesh(geo, mat);
        obj.castShadow = true;
        obj.receiveShadow = true;
      } else if (c.LightComponent) {
        const lc = c.LightComponent;
        if (lc.type === 'ambient') {
          const light = new THREE.AmbientLight(lc.color, lc.intensity);
          scene.add(light);
          continue;
        }
        const grp = new THREE.Group();
        let light;
        if (lc.type === 'directional') {
          light = new THREE.DirectionalLight(lc.color, lc.intensity);
          light.shadow.mapSize.setScalar(2048);
          light.shadow.camera.near = 0.1; light.shadow.camera.far = 100;
          light.shadow.camera.left = -15; light.shadow.camera.right = 15;
          light.shadow.camera.top = 15; light.shadow.camera.bottom = -15;
          const t = new THREE.Object3D(); t.position.set(0,-1,0); grp.add(t); light.target = t;
        } else if (lc.type === 'spot') {
          light = new THREE.SpotLight(lc.color, lc.intensity, lc.distance ?? 1);
          light.angle = Math.PI / 6; light.penumbra = 0.2;
          light.shadow.mapSize.setScalar(1024);
          const t = new THREE.Object3D(); t.position.set(0,-1,0); grp.add(t); light.target = t;
        } else {
          light = new THREE.PointLight(lc.color, lc.intensity, lc.distance ?? 1, 2);
          light.shadow.mapSize.setScalar(512);
        }
        light.castShadow = true;
        light.shadow.bias = -0.0003;
        grp.add(light);
        obj = grp;
      } else if (c.FogComponent) {
        const fc = c.FogComponent;
        scene.fog = new THREE.Fog(fc.color, fc.near, fc.far);
        continue;
      } else if (c.CameraComponent) {
        const cc = c.CameraComponent;
        camera.fov = cc.fov ?? 60;
        camera.near = cc.near ?? 0.1;
        camera.far = cc.far ?? 1000;
        camera.updateProjectionMatrix();
        if (c.TransformComponent) {
          const t = c.TransformComponent;
          camera.position.fromArray(t.position);
          camera.rotation.set(t.rotation[0], t.rotation[1], t.rotation[2], t.rotation[3]);
        }
        continue;
      } else if ('TriggerComponent' in c || 'PlayerStartComponent' in c) {
        continue;
      } else {
        obj = new THREE.Object3D();
      }
      if (c.TransformComponent && obj) {
        const t = c.TransformComponent;
        obj.position.fromArray(t.position);
        obj.rotation.set(t.rotation[0], t.rotation[1], t.rotation[2], t.rotation[3]);
        obj.scale.fromArray(t.scale);
      }
      objs.set(id, obj);
    }
    for (const { id, components: c } of worldData.entities) {
      const obj = objs.get(id);
      if (!obj) continue;
      if (c.ParentComponent) {
        const parent = objs.get(c.ParentComponent.parentId);
        if (parent) { parent.add(obj); continue; }
      }
      scene.add(obj);
    }
  }

  // Extract initial yaw/pitch from camera rotation
  const euler = new THREE.Euler();
  euler.setFromQuaternion(camera.quaternion, 'YXZ');
  let pitch = euler.x, yaw = euler.y;
  const keys = {};

  document.addEventListener('keydown', e => { keys[e.code] = true; if (e.key === 'Escape' && document.pointerLockElement) document.exitPointerLock(); });
  document.addEventListener('keyup', e => { keys[e.code] = false; });
  document.addEventListener('mousemove', e => {
    if (document.pointerLockElement !== renderer.domElement) return;
    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  });
  renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  const clock = new THREE.Clock();
  document.getElementById('loading').style.display = 'none';

  (function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const speed = 5 * delta;
    const fwd = new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw)*Math.cos(pitch));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const up = new THREE.Vector3(0, 1, 0);
    if (keys['KeyW']) camera.position.addScaledVector(fwd, speed);
    if (keys['KeyS']) camera.position.addScaledVector(fwd, -speed);
    if (keys['KeyA']) camera.position.addScaledVector(right, -speed);
    if (keys['KeyD']) camera.position.addScaledVector(right, speed);
    if (keys['KeyE']) camera.position.addScaledVector(up, speed);
    if (keys['KeyQ']) camera.position.addScaledVector(up, -speed);
    renderer.render(scene, camera);
  })();
})();
`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${project.name}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#000;overflow:hidden}
    canvas{display:block}
    #loading{position:fixed;inset:0;background:#000;display:flex;align-items:center;justify-content:center;color:#fff;font-family:system-ui;font-size:20px;letter-spacing:2px}
    #hud{position:fixed;bottom:12px;right:12px;color:rgba(255,255,255,0.3);font-family:system-ui;font-size:11px;pointer-events:none;white-space:nowrap;text-align:right;line-height:1.8}
  </style>
</head>
<body>
  <div id="loading">Loading...</div>
  <div id="hud">${this.#esc(sceneName)}<br>Click: mouse look &nbsp;|&nbsp; WASD: move &nbsp;|&nbsp; Q/E: down/up &nbsp;|&nbsp; Esc: unlock</div>
  <script type="importmap">
  {"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.webgpu.js","three/webgpu":"https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.webgpu.js"}}
  </script>
  <script type="module">
  import * as THREE from 'three';
  ${runtimeCode}
  </script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_game.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Game exported as HTML', 'success');
  }

  #refreshTitle() {
    const info = this.#el?.querySelector('.topbar-info');
    if (info) info.textContent = `${this.#editor.project.name} \u2014 ${this.#currentSceneName()}`;
  }

  #closeMenus() {
    this.#el?.querySelectorAll('.topbar-dropdown').forEach(d => d.classList.remove('open'));
    this.#openMenu = null;
  }

  #currentSceneName() {
    const s = this.#editor.project.scenes[this.#editor.currentSceneIndex];
    return s ? this.#esc(s.name) : 'Scene';
  }

  #esc(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
}
