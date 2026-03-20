import { numInput, colorToHex, hexToNum, makeCollapsiblePanel } from './utils.js';
import { TagComponent } from '../components/TagComponent.js';
import { TransformComponent } from '../components/TransformComponent.js';
import { MeshComponent } from '../components/MeshComponent.js';
import { LightComponent } from '../components/LightComponent.js';
import { TriggerComponent } from '../components/TriggerComponent.js';
import { ParentComponent } from '../components/ParentComponent.js';
import { CameraComponent } from '../components/CameraComponent.js';
import { FogComponent } from '../components/FogComponent.js';

export class InspectorPanel {
  #el = null;
  #editor = null;
  #unsubs = [];

  constructor(editor) { this.#editor = editor; }

  mount(parent) {
    this.#el = document.createElement('div');
    this.#el.className = 'panel';
    this.#el.style.cssText = 'flex:1;min-height:0;';
    parent.appendChild(this.#el);
    this.#render();
    this.#unsubs.push(
      this.#editor.on('entity:selected', () => this.#render()),
      this.#editor.on('entity:changed', () => this.#renderTransformValues()),
      this.#editor.on('scene:switched', () => this.#render()),
      this.#editor.on('scenes:changed', () => {
        // Re-render only if showing scene settings (nothing selected)
        if (this.#editor.selectedEntityId === null) this.#render();
      }),
    );
  }

  destroy() {
    this.#unsubs.forEach(u => u());
    this.#el?.remove();
  }

  #render() {
    this.#el.innerHTML = '<div class="panel-header"><span>&#128196; Detalhes</span></div><div class="panel-content" id="insp-content"></div>';
    makeCollapsiblePanel(
      this.#el.querySelector('.panel-header'),
      this.#el.querySelector('#insp-content'),
      true
    );
    const content = this.#el.querySelector('#insp-content');
    const entityId = this.#editor.selectedEntityId;

    if (entityId === null) {
      this.#renderSceneSettings(content);
      return;
    }

    const world = this.#editor.world;

    // Parent indicator — shown ABOVE name, just below header
    const parentComp = world.getComponent(entityId, ParentComponent);
    if (parentComp) {
      const parentTag = world.getComponent(parentComp.parentId, TagComponent);
      const badge = document.createElement('div');
      badge.style.cssText = 'padding:4px 12px;font-size:11px;color:var(--accent2);background:var(--bg-dark);border-bottom:1px solid var(--border);';
      badge.textContent = `↳ Child of: ${parentTag?.name ?? 'Group'} (local coords)`;
      content.appendChild(badge);
    }

    // Name
    const tag = world.getComponent(entityId, TagComponent);
    if (tag) {
      const nameInput = document.createElement('input');
      nameInput.className = 'inspector-name-input';
      nameInput.value = tag.name;
      nameInput.placeholder = 'Entity name';
      nameInput.addEventListener('change', () => {
        this.#editor.renameEntity(entityId, nameInput.value.trim() || 'Entity');
      });
      content.appendChild(nameInput);
    }

    // Transform
    const transform = world.getComponent(entityId, TransformComponent);
    if (transform) content.appendChild(this.#buildTransformSection(entityId, transform));

    // Mesh
    const mesh = world.getComponent(entityId, MeshComponent);
    if (mesh) content.appendChild(this.#buildMeshSection(entityId, mesh));

    // Light
    const light = world.getComponent(entityId, LightComponent);
    if (light) content.appendChild(this.#buildLightSection(entityId, light));

    // Camera
    const camera = world.getComponent(entityId, CameraComponent);
    if (camera) content.appendChild(this.#buildCameraSection(entityId, camera));

    // Fog
    const fog = world.getComponent(entityId, FogComponent);
    if (fog) content.appendChild(this.#buildFogSection(entityId, fog));

    // Trigger
    const trigger = world.getComponent(entityId, TriggerComponent);
    if (trigger) content.appendChild(this.#buildTriggerSection(entityId, trigger));
  }

  #renderSceneSettings(content) {
    const name = this.#editor.getSceneName();
    const bg = this.#editor.getSceneBackground();

    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:8px 12px;';

    const label = document.createElement('div');
    label.style.cssText = 'font-size:10px;text-transform:uppercase;color:var(--text-muted,#888);letter-spacing:0.5px;margin-bottom:10px;';
    label.textContent = 'Scene Settings';
    wrap.appendChild(label);

    // Scene name row
    const nameRow = document.createElement('div');
    nameRow.className = 'inspector-row';
    nameRow.innerHTML = '<span class="inspector-label">Name</span>';
    const nameInp = document.createElement('input');
    nameInp.className = 'inspector-input';
    nameInp.value = name;
    nameInp.style.flex = '1';
    nameInp.addEventListener('change', () => {
      this.#editor.renameScene(this.#editor.currentSceneIndex, nameInp.value.trim() || name);
    });
    nameRow.appendChild(nameInp);
    wrap.appendChild(nameRow);

    // Background color row
    const bgRow = document.createElement('div');
    bgRow.className = 'inspector-row';
    bgRow.style.marginTop = '6px';
    bgRow.innerHTML = '<span class="inspector-label">Background</span>';
    const bgInp = document.createElement('input');
    bgInp.type = 'color';
    bgInp.className = 'inspector-input';
    bgInp.value = bg;
    bgInp.style.cssText = 'width:44px;padding:1px 2px;height:24px;cursor:pointer;';
    bgInp.addEventListener('input', () => {
      this.#editor.setSceneBackground(bgInp.value);
    });
    bgRow.appendChild(bgInp);
    wrap.appendChild(bgRow);

    content.appendChild(wrap);
  }

  #buildTransformSection(entityId, transform) {
    const sec = this.#section('Transform', 'transform-section');
    const body = sec.querySelector('.inspector-section-body');
    body.style.padding = '4px 0 8px';

    const makeVec3Block = (label, getVal, setVal, step = 0.01) => {
      const group = document.createElement('div');
      group.className = 'vec3-group';

      const labelEl = document.createElement('div');
      labelEl.className = 'vec3-label';
      labelEl.textContent = label;
      group.appendChild(labelEl);

      const row = document.createElement('div');
      row.className = 'vec3-inputs';

      ['x', 'y', 'z'].forEach(axis => {
        const wrap = document.createElement('div');
        wrap.className = 'vec3-input-wrap';

        const axlbl = document.createElement('span');
        axlbl.className = `xyz-label ${axis}`;
        axlbl.textContent = axis.toUpperCase();

        const inp = numInput(getVal(axis), (val) => { setVal(axis, val); }, step);
        inp.dataset.vecAxis = `${label}-${axis}`;

        wrap.appendChild(axlbl);
        wrap.appendChild(inp);
        row.appendChild(wrap);
      });

      group.appendChild(row);
      return group;
    };

    const sync = () => this.#editor.emit('entity:changed', entityId);

    body.appendChild(makeVec3Block('Position',
      axis => transform.position[axis],
      (axis, val) => { transform.position[axis] = val; sync(); }
    ));
    body.appendChild(makeVec3Block('Rotation',
      axis => transform.rotation[axis] * 180 / Math.PI,
      (axis, val) => { transform.rotation[axis] = val * Math.PI / 180; sync(); },
      1
    ));
    // Scale is hidden for cameras and lights (not applicable)
    const isScaleLocked = this.#editor.isScaleLocked(entityId);
    if (!isScaleLocked) {
      body.appendChild(makeVec3Block('Scale',
        axis => transform.scale[axis],
        (axis, val) => { transform.scale[axis] = val; sync(); }
      ));
    }

    return sec;
  }

  #buildMeshSection(entityId, mesh) {
    const sec = this.#section('Mesh', 'mesh-section');
    const body = sec.querySelector('.inspector-section-body');

    const typeRow = document.createElement('div');
    typeRow.className = 'inspector-row';
    typeRow.innerHTML = '<span class="inspector-label">Type</span>';
    const sel = document.createElement('select');
    sel.className = 'inspector-select';
    ['box','sphere','cone','cylinder','capsule','plane'].forEach(t => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      if (t === mesh.type) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => { mesh.type = sel.value; this.#editor.rebuildEntityObject(entityId); });
    typeRow.appendChild(sel);
    body.appendChild(typeRow);

    const colorRow = document.createElement('div');
    colorRow.className = 'inspector-row';
    colorRow.innerHTML = '<span class="inspector-label">Color</span>';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'inspector-input';
    colorInput.value = colorToHex(mesh.color);
    colorInput.addEventListener('input', () => { mesh.color = hexToNum(colorInput.value); this.#editor.updateEntityColor(entityId, colorInput.value); });
    colorRow.appendChild(colorInput);
    body.appendChild(colorRow);

    return sec;
  }

  #buildLightSection(entityId, light) {
    const sec = this.#section('Light', 'light-section');
    const body = sec.querySelector('.inspector-section-body');

    const typeRow = document.createElement('div');
    typeRow.className = 'inspector-row';
    typeRow.innerHTML = '<span class="inspector-label">Type</span>';
    const sel = document.createElement('select');
    sel.className = 'inspector-select';
    ['point','directional','spot','ambient'].forEach(t => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      if (t === light.type) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => { light.type = sel.value; this.#editor.rebuildEntityObject(entityId); });
    typeRow.appendChild(sel);
    body.appendChild(typeRow);

    const colorRow = document.createElement('div');
    colorRow.className = 'inspector-row';
    colorRow.innerHTML = '<span class="inspector-label">Color</span>';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'inspector-input';
    colorInput.value = colorToHex(light.color);
    colorInput.addEventListener('input', () => { light.color = hexToNum(colorInput.value); this.#editor.updateEntityLight(entityId); });
    colorRow.appendChild(colorInput);
    body.appendChild(colorRow);

    const intRow = document.createElement('div');
    intRow.className = 'inspector-row';
    intRow.innerHTML = '<span class="inspector-label">Intensity</span>';
    const intField = document.createElement('div');
    intField.className = 'inspector-field-axis';
    const intInp = numInput(light.intensity, (val) => { light.intensity = Math.max(0, val); this.#editor.updateEntityLight(entityId); }, 1);
    intField.appendChild(intInp);
    intRow.appendChild(intField);
    body.appendChild(intRow);

    // Range (distance) — only relevant for point and spot
    if (light.type === 'point' || light.type === 'spot') {
      const distRow = document.createElement('div');
      distRow.className = 'inspector-row';
      distRow.innerHTML = '<span class="inspector-label">Range</span>';
      const distField = document.createElement('div');
      distField.className = 'inspector-field-axis';
      const distInp = numInput(light.distance ?? 10, (val) => {
        light.distance = Math.max(0.1, val);
        this.#editor.updateEntityLight(entityId);
      }, 0.5);
      distField.appendChild(distInp);
      distRow.appendChild(distField);
      body.appendChild(distRow);
    }

    return sec;
  }

  #buildCameraSection(entityId, camera) {
    const sec = this.#section('Camera', 'camera-section');
    const body = sec.querySelector('.inspector-section-body');

    const fovRow = document.createElement('div');
    fovRow.className = 'inspector-row';
    fovRow.innerHTML = '<span class="inspector-label">FOV</span>';
    const fovField = document.createElement('div');
    fovField.className = 'inspector-field-axis';
    const fovInp = numInput(camera.fov, (val) => {
      camera.fov = Math.max(10, Math.min(170, val));
      this.#editor.updateEntityCamera(entityId);
    }, 1);
    fovField.appendChild(fovInp);
    fovRow.appendChild(fovField);
    body.appendChild(fovRow);

    const nearRow = document.createElement('div');
    nearRow.className = 'inspector-row';
    nearRow.innerHTML = '<span class="inspector-label">Near</span>';
    const nearField = document.createElement('div');
    nearField.className = 'inspector-field-axis';
    const nearInp = numInput(camera.near, (val) => {
      camera.near = Math.max(0.001, val);
      this.#editor.updateEntityCamera(entityId);
    }, 0.01);
    nearField.appendChild(nearInp);
    nearRow.appendChild(nearField);
    body.appendChild(nearRow);

    const farRow = document.createElement('div');
    farRow.className = 'inspector-row';
    farRow.innerHTML = '<span class="inspector-label">Far</span>';
    const farField = document.createElement('div');
    farField.className = 'inspector-field-axis';
    const farInp = numInput(camera.far, (val) => {
      camera.far = Math.max(1, val);
      this.#editor.updateEntityCamera(entityId);
    }, 10);
    farField.appendChild(farInp);
    farRow.appendChild(farField);
    body.appendChild(farRow);

    return sec;
  }

  #buildTriggerSection(entityId, trigger) {
    const sec = this.#section('Trigger', 'trigger-section');
    const body = sec.querySelector('.inspector-section-body');

    const typeRow = document.createElement('div');
    typeRow.className = 'inspector-row';
    typeRow.innerHTML = '<span class="inspector-label">Type</span>';
    const sel = document.createElement('select');
    sel.className = 'inspector-select';
    ['box','sphere'].forEach(t => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      if (t === trigger.type) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => { trigger.type = sel.value; this.#editor.rebuildEntityObject(entityId); });
    typeRow.appendChild(sel);
    body.appendChild(typeRow);

    const sizeRow = document.createElement('div');
    sizeRow.className = 'inspector-row';
    sizeRow.innerHTML = '<span class="inspector-label">Size</span>';
    const sizeField = document.createElement('div');
    sizeField.className = 'inspector-field-axis';
    const sizeInp = numInput(trigger.size, (val) => { trigger.size = Math.max(0.01, val); this.#editor.rebuildEntityObject(entityId); }, 0.1);
    sizeField.appendChild(sizeInp);
    sizeRow.appendChild(sizeField);
    body.appendChild(sizeRow);

    return sec;
  }

  #buildFogSection(entityId, fog) {
    const sec = this.#section('Fog', 'fog-section');
    const body = sec.querySelector('.inspector-section-body');

    const colorRow = document.createElement('div');
    colorRow.className = 'inspector-row';
    colorRow.innerHTML = '<span class="inspector-label">Color</span>';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'inspector-input';
    colorInput.value = colorToHex(fog.color);
    colorInput.style.cssText = 'width:44px;padding:1px 2px;height:24px;cursor:pointer;';
    colorInput.addEventListener('input', () => { fog.color = hexToNum(colorInput.value); });
    colorRow.appendChild(colorInput);
    body.appendChild(colorRow);

    const mkRow = (label, get, set, step) => {
      const row = document.createElement('div');
      row.className = 'inspector-row';
      row.innerHTML = `<span class="inspector-label">${label}</span>`;
      const field = document.createElement('div');
      field.className = 'inspector-field-axis';
      field.appendChild(numInput(get(), set, step));
      row.appendChild(field);
      body.appendChild(row);
    };
    mkRow('Near', () => fog.near, v => { fog.near = Math.max(0, v); }, 0.5);
    mkRow('Far',  () => fog.far,  v => { fog.far  = Math.max(fog.near + 0.1, v); }, 1);

    return sec;
  }

  #renderTransformValues() {
    const entityId = this.#editor.selectedEntityId;
    if (!entityId) return;
    const transform = this.#editor.world?.getComponent(entityId, TransformComponent);
    if (!transform) return;
    const props = [
      { label: 'Position', vec: transform.position, mult: 1 },
      { label: 'Rotation', vec: transform.rotation, mult: 180/Math.PI },
      { label: 'Scale', vec: transform.scale, mult: 1 },
    ];
    for (const { label, vec, mult } of props) {
      for (const axis of ['x','y','z']) {
        const inp = this.#el.querySelector(`[data-vec-axis="${label}-${axis}"]`);
        if (inp && document.activeElement !== inp) {
          inp.value = (vec[axis] * mult).toFixed(3);
        }
      }
    }
  }

  #section(title, id) {
    const sec = document.createElement('div');
    sec.className = 'inspector-section';
    sec.id = id;
    sec.innerHTML = `
      <div class="inspector-section-header">
        <span class="chevron">&#9660;</span>
        <span>${title}</span>
      </div>
      <div class="inspector-section-body"></div>
    `;
    const header = sec.querySelector('.inspector-section-header');
    const body = sec.querySelector('.inspector-section-body');
    header.addEventListener('click', () => {
      header.classList.toggle('collapsed');
      body.classList.toggle('collapsed');
    });
    return sec;
  }
}
