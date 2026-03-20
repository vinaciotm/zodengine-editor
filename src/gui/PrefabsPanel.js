import { sfx } from './sfx.js';

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
        { spawn: 'cube',     icon: '&#9635;',  label: 'Cube' },
        { spawn: 'sphere',   icon: '&#9679;',  label: 'Sphere' },
        { spawn: 'cone',     icon: '&#9651;',  label: 'Cone' },
        { spawn: 'cylinder', icon: '&#9646;',  label: 'Cylinder' },
        { spawn: 'capsule',  icon: '&#9700;',  label: 'Capsule' },
        { spawn: 'plane',    icon: '&#9644;',  label: 'Plane' },
      ],
      luz: [
        { spawn: 'pointlight', icon: '&#128161;', label: 'Point' },
        { spawn: 'dirlight',   icon: '&#9728;',   label: 'Directional' },
        { spawn: 'spotlight',  icon: '&#128294;', label: 'Spot' },
      ],
      ambiente: [
        { spawn: 'ambientlight', icon: '&#127774;', label: 'Ambient' },
        { spawn: 'fog',          icon: '&#127568;', label: 'Fog' },
      ],
      jogo: [
        { spawn: 'camera',        icon: '&#127909;', label: 'Camera' },
        { spawn: 'spheretrigger', icon: '&#128993;', label: 'SphereTrig' },
        { spawn: 'boxtrigger',    icon: '&#128243;', label: 'BoxTrig' },
        { spawn: 'playerstart',   icon: '&#128694;', label: 'Start' },
      ],
    };

    const catDefs = [
      { id: 'formas',   icon: '&#9635;',    label: 'Formas' },
      { id: 'luz',      icon: '&#128161;',  label: 'Luz' },
      { id: 'ambiente', icon: '&#127774;',  label: 'Ambiente' },
      { id: 'jogo',     icon: '&#127918;',  label: 'Jogo' },
    ];

    const spawnMap = {
      cube:         () => this.#editor.spawnCube(),
      sphere:       () => this.#editor.spawnSphere(),
      cone:         () => this.#editor.spawnCone(),
      cylinder:     () => this.#editor.spawnCylinder(),
      capsule:      () => this.#editor.spawnCapsule(),
      plane:        () => this.#editor.spawnPlane(),
      pointlight:   () => this.#editor.spawnPointLight(),
      dirlight:     () => this.#editor.spawnDirectionalLight(),
      spotlight:    () => this.#editor.spawnSpotLight(),
      camera:       () => this.#editor.spawnCamera(),
      spheretrigger:() => this.#editor.spawnSphereTrigger(),
      boxtrigger:   () => this.#editor.spawnBoxTrigger(),
      playerstart:  () => this.#editor.spawnPlayerStart(),
      ambientlight: () => this.#editor.spawnAmbientLight(),
      fog:          () => this.#editor.spawnFog(),
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
      for (const item of (categories[cat] ?? [])) {
        const btn = document.createElement('button');
        btn.className = 'asset-item';
        btn.dataset.spawn = item.spawn;
        btn.innerHTML = `<span class="asset-icon">${item.icon}</span><span class="asset-label">${item.label}</span>`;
        btn.addEventListener('click', () => {
          const id = spawnMap[item.spawn]?.();
          if (id !== undefined) { sfx.in(); this.#editor.selectEntity(id); }
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
