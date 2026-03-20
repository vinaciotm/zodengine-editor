import { makeCollapsiblePanel } from './utils.js';

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
    this.#el.innerHTML = `
      <div class="panel-header" id="prefabs-header"><span>&#128736; Elements</span></div>
      <div class="panel-content" id="prefabs-content" style="overflow-y:auto;flex:1;">
        <div class="prefab-section-title">Primitives</div>
        <div class="prefab-grid">
          <button class="prefab-btn" data-spawn="cube"><span class="icon">&#9635;</span>Cube</button>
          <button class="prefab-btn" data-spawn="sphere"><span class="icon">&#9679;</span>Sphere</button>
          <button class="prefab-btn" data-spawn="cone"><span class="icon">&#9651;</span>Cone</button>
          <button class="prefab-btn" data-spawn="cylinder"><span class="icon">&#9646;</span>Cylinder</button>
          <button class="prefab-btn" data-spawn="capsule"><span class="icon">&#9700;</span>Capsule</button>
          <button class="prefab-btn" data-spawn="plane"><span class="icon">&#9644;</span>Plane</button>
        </div>
        <div class="prefab-section-title">Lights</div>
        <div class="prefab-grid">
          <button class="prefab-btn" data-spawn="pointlight"><span class="icon">&#128161;</span>Point</button>
          <button class="prefab-btn" data-spawn="dirlight"><span class="icon">&#9728;</span>Dir</button>
          <button class="prefab-btn" data-spawn="spotlight"><span class="icon">&#128294;</span>Spot</button>
        </div>
        <div class="prefab-section-title">Other</div>
        <div class="prefab-grid">
          <button class="prefab-btn" data-spawn="camera"><span class="icon">&#127909;</span>Camera</button>
          <button class="prefab-btn" data-spawn="spheretrigger"><span class="icon">&#128993;</span>SphereTrig</button>
          <button class="prefab-btn" data-spawn="boxtrigger"><span class="icon">&#128243;</span>BoxTrig</button>
          <button class="prefab-btn" data-spawn="playerstart"><span class="icon">&#128694;</span>Player</button>
        </div>
        <div class="prefab-section-title">Environment</div>
        <div class="prefab-grid">
          <button class="prefab-btn" data-spawn="ambientlight"><span class="icon">&#127774;</span>Ambient</button>
          <button class="prefab-btn" data-spawn="fog"><span class="icon">&#127568;</span>Fog</button>
        </div>
      </div>
    `;

    makeCollapsiblePanel(
      this.#el.querySelector('#prefabs-header'),
      this.#el.querySelector('#prefabs-content'),
      true
    );

    const spawnMap = {
      cube: () => this.#editor.spawnCube(),
      sphere: () => this.#editor.spawnSphere(),
      cone: () => this.#editor.spawnCone(),
      cylinder: () => this.#editor.spawnCylinder(),
      capsule: () => this.#editor.spawnCapsule(),
      plane: () => this.#editor.spawnPlane(),
      pointlight: () => this.#editor.spawnPointLight(),
      dirlight: () => this.#editor.spawnDirectionalLight(),
      spotlight: () => this.#editor.spawnSpotLight(),
      camera: () => this.#editor.spawnCamera(),
      spheretrigger: () => this.#editor.spawnSphereTrigger(),
      boxtrigger: () => this.#editor.spawnBoxTrigger(),
      playerstart: () => this.#editor.spawnPlayerStart(),
      ambientlight: () => this.#editor.spawnAmbientLight(),
      fog: () => this.#editor.spawnFog(),
    };

    this.#el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-spawn]');
      if (!btn) return;
      const id = spawnMap[btn.dataset.spawn]?.();
      if (id !== undefined) this.#editor.selectEntity(id);
    });
  }
}
