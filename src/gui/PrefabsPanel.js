import { sfx } from './sfx.js';
import { iconURL } from './entityIcons.js';

const CANVAS_ICON_MAP = {
  cube:         'mesh_box',
  sphere:       'mesh_sphere',
  cone:         'mesh_cone',
  cylinder:     'mesh_cylinder',
  capsule:      'mesh_capsule',
  plane:        'mesh_plane',
  pointlight:   'light_point',
  dirlight:     'light_directional',
  spotlight:    'light_spot',
  ambientlight: 'light_ambient',
  fog:          'fog',
  sky:          'sky',
  camera:       'camera',
  spheretrigger:'trigger_sphere',
  boxtrigger:   'trigger_box',
  playerstart:  'start_flag',
};

export class PrefabsPanel {
  #el = null;
  #editor = null;

  constructor(editor) { this.#editor = editor; }

  mount(parent) {
    this.#el = document.createElement('div');
    this.#el.className = 'panel';
    this.#el.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;';
    parent.appendChild(this.#el);
    this.#render();
  }

  destroy() { this.#el?.remove(); }

  #render() {
    const categories = {
      formas: [
        { spawn: 'cube',     label: 'Cube' },
        { spawn: 'sphere',   label: 'Sphere' },
        { spawn: 'cone',     label: 'Cone' },
        { spawn: 'cylinder', label: 'Cylinder' },
        { spawn: 'capsule',  label: 'Capsule' },
        { spawn: 'plane',    label: 'Plane' },
        { spawn: 'ramp',     label: 'Ramp' },
        { spawn: 'barrel',   label: 'Barrel' },
        { spawn: 'screw',    label: 'Screw' },
      ],
      luz: [
        { spawn: 'pointlight', label: 'Point' },
        { spawn: 'dirlight',   label: 'Directional' },
        { spawn: 'spotlight',  label: 'Spot' },
      ],
      ambiente: [
        { spawn: 'ambientlight', label: 'Ambient' },
        { spawn: 'fog',          label: 'Fog' },
        { spawn: 'sky',          label: 'SkyBox' },
      ],
      jogo: [
        { spawn: 'camera',        label: 'Camera' },
        { spawn: 'spheretrigger', label: 'SphereTrig' },
        { spawn: 'boxtrigger',    label: 'BoxTrig' },
        { spawn: 'playerstart',   label: 'Start' },
      ],
      modelos: [],
      prefabs: [],
    };

    const catDefs = [
      { id: 'formas',   icon: '&#9635;',    label: 'Formas' },
      { id: 'luz',      icon: '&#128161;',  label: 'Luz' },
      { id: 'ambiente', icon: '&#127774;',  label: 'Ambiente' },
      { id: 'jogo',     icon: '&#127918;',  label: 'Jogo' },
      { id: 'modelos',  icon: '&#128190;',  label: 'Modelos' },
      { id: 'prefabs',  icon: '&#11835;',   label: 'Prefabs' },
    ];

    const spawnMap = {
      cube:         () => this.#editor.spawnCube(),
      sphere:       () => this.#editor.spawnSphere(),
      cone:         () => this.#editor.spawnCone(),
      cylinder:     () => this.#editor.spawnCylinder(),
      capsule:      () => this.#editor.spawnCapsule(),
      plane:        () => this.#editor.spawnPlane(),
      ramp:         () => this.#editor.spawnRamp(),
      barrel:       () => this.#editor.spawnBarrel(),
      screw:        () => this.#editor.spawnScrew(),
      pointlight:   () => this.#editor.spawnPointLight(),
      dirlight:     () => this.#editor.spawnDirectionalLight(),
      spotlight:    () => this.#editor.spawnSpotLight(),
      camera:       () => this.#editor.spawnCamera(),
      spheretrigger:() => this.#editor.spawnSphereTrigger(),
      boxtrigger:   () => this.#editor.spawnBoxTrigger(),
      playerstart:  () => this.#editor.spawnPlayerStart(),
      ambientlight: () => this.#editor.spawnAmbientLight(),
      fog:          () => this.#editor.spawnFog(),
      sky:          () => this.#editor.spawnSky(),
    };

    this.#el.innerHTML = `
      <div class="panel-header" id="assets-header">
        <span class="ph-icon">&#128230;</span><span class="ph-text"> Elementos</span>
      </div>
      <div class="assets-panel" id="assets-body">
        <div class="assets-tabs">
          ${catDefs.map((c, i) => `
            <button class="assets-tab${i === 0 ? ' active' : ''}" data-cat="${c.id}">
              <span>${c.icon}</span>${c.label}
            </button>
          `).join('')}
        </div>
        <div class="assets-grid-wrap" id="assets-grid"></div>
      </div>
    `;

    // Collapsible footer
    const headerEl = this.#el.querySelector('#assets-header');
    const bodyEl   = this.#el.querySelector('#assets-body');
    const OPEN_H   = 160;
    const CLOSED_H = 32;
    let open = true;

    const chevron = document.createElement('span');
    chevron.className = 'panel-chevron';
    chevron.innerHTML = '&#9660;';
    chevron.style.cssText = 'font-size:9px;margin-right:6px;display:inline-block;transition:transform 0.25s;flex-shrink:0;';
    headerEl.insertBefore(chevron, headerEl.firstChild);
    headerEl.style.cursor = 'pointer';

    headerEl.addEventListener('click', () => {
      open = !open;
      chevron.style.transform = open ? '' : 'rotate(-90deg)';
      bodyEl.style.display = open ? '' : 'none';
      const footer = this.#el.closest('.editor-footer');
      if (footer) footer.style.height = open ? OPEN_H + 'px' : CLOSED_H + 'px';
      open ? sfx.in() : sfx.out();
    });

    const grid = this.#el.querySelector('#assets-grid');
    let activeCat = 'formas';

    const showCategory = (cat) => {
      grid.innerHTML = '';

      // Modelos tab: import button + empty list
      if (cat === 'modelos') {
        const importBtn = document.createElement('button');
        importBtn.className = 'asset-item asset-import-btn';
        importBtn.innerHTML = `<span style="font-size:18px;display:block;margin-bottom:2px;">&#8853;</span><span class="asset-label">Import</span>`;
        importBtn.title = 'Import 3D model (GLB/GLTF)';
        importBtn.addEventListener('click', () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.glb,.gltf,.obj,.fbx';
          input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (!file) return;
            this.#editor.emit('model:import', file);
          });
          input.click();
        });
        grid.appendChild(importBtn);
        const emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'color:var(--text-muted,#777);font-size:10px;padding:8px 4px;text-align:center;width:100%;';
        emptyMsg.textContent = 'No models imported';
        grid.appendChild(emptyMsg);
        return;
      }

      // Prefabs tab: empty state
      if (cat === 'prefabs') {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'color:var(--text-muted,#777);font-size:10px;padding:8px 4px;text-align:center;width:100%;';
        emptyMsg.textContent = 'No prefabs saved';
        grid.appendChild(emptyMsg);
        return;
      }

      for (const item of (categories[cat] ?? [])) {
        const btn = document.createElement('button');
        btn.className = 'asset-item';
        btn.dataset.spawn = item.spawn;
        const canvasType = CANVAS_ICON_MAP[item.spawn];
        const iconHtml = canvasType
          ? `<img src="${iconURL(canvasType)}" width="22" height="22" style="display:block;margin:0 auto 2px;">`
          : `<span class="asset-icon" style="font-size:20px;display:block;margin-bottom:2px;">${item.icon ?? '&#9635;'}</span>`;
        btn.innerHTML = `${iconHtml}<span class="asset-label">${item.label}</span>`;
        btn.addEventListener('click', () => {
          const id = spawnMap[item.spawn]?.();
          if (id !== undefined) { this.#editor.selectEntity(id); }
        });
        grid.appendChild(btn);
      }
    };

    showCategory(activeCat);

    this.#el.querySelectorAll('.assets-tab').forEach(tabEl => {
      tabEl.addEventListener('click', () => {
        this.#el.querySelectorAll('.assets-tab').forEach(t => t.classList.remove('active'));
        tabEl.classList.add('active');
        activeCat = tabEl.dataset.cat;
        showCategory(activeCat);
      });
    });
  }
}
