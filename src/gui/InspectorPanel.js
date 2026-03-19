import { numInput, colorToHex, hexToNum } from './utils.js';
import { TagComponent } from '../components/TagComponent.js';
import { TransformComponent } from '../components/TransformComponent.js';
import { MeshComponent } from '../components/MeshComponent.js';
import { LightComponent } from '../components/LightComponent.js';
import { TriggerComponent } from '../components/TriggerComponent.js';

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
    );
  }

  destroy() {
    this.#unsubs.forEach(u => u());
    this.#el?.remove();
  }

  #render() {
    this.#el.innerHTML = '<div class="panel-header"><span>&#128196; Inspector</span></div><div class="panel-content" id="insp-content"></div>';
    const content = this.#el.querySelector('#insp-content');
    const entityId = this.#editor.selectedEntityId;

    if (entityId === null) {
      content.innerHTML = '<div class="inspector-empty">Select an entity to inspect</div>';
      return;
    }

    const world = this.#editor.world;

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

    // Trigger
    const trigger = world.getComponent(entityId, TriggerComponent);
    if (trigger) content.appendChild(this.#buildTriggerSection(entityId, trigger));
  }

  #buildTransformSection(entityId, transform) {
    const sec = this.#section('Transform', 'transform-section');
    const body = sec.querySelector('.inspector-section-body');

    const makeVec3Row = (label, vec, onChange) => {
      const row = document.createElement('div');
      row.className = 'inspector-row';
      row.innerHTML = `<span class="inspector-label">${label}</span>`;
      const field = document.createElement('div');
      field.className = 'inspector-field';
      ['x','y','z'].forEach(axis => {
        const lbl = document.createElement('span');
        lbl.className = `xyz-label ${axis}`;
        lbl.textContent = axis.toUpperCase();
        const inp = numInput(vec[axis], (val) => { vec[axis] = val; onChange(); });
        inp.dataset.vecAxis = `${label}-${axis}`;
        field.appendChild(lbl);
        field.appendChild(inp);
      });
      row.appendChild(field);
      return row;
    };

    const sync = () => this.#editor.emit('entity:changed', entityId);
    body.appendChild(makeVec3Row('Position', transform.position, sync));

    // Rotation in degrees for UX
    const rotDeg = {
      x: transform.rotation.x * 180 / Math.PI,
      y: transform.rotation.y * 180 / Math.PI,
      z: transform.rotation.z * 180 / Math.PI,
    };
    const rotRow = document.createElement('div');
    rotRow.className = 'inspector-row';
    rotRow.innerHTML = '<span class="inspector-label">Rotation</span>';
    const rotField = document.createElement('div');
    rotField.className = 'inspector-field';
    ['x','y','z'].forEach(axis => {
      const lbl = document.createElement('span');
      lbl.className = `xyz-label ${axis}`;
      lbl.textContent = axis.toUpperCase();
      const inp = numInput(rotDeg[axis], (val) => {
        transform.rotation[axis] = val * Math.PI / 180;
        sync();
      }, 1);
      rotField.appendChild(lbl);
      rotField.appendChild(inp);
    });
    rotRow.appendChild(rotField);
    body.appendChild(rotRow);

    body.appendChild(makeVec3Row('Scale', transform.scale, sync));
    return sec;
  }

  #buildMeshSection(entityId, mesh) {
    const sec = this.#section('Mesh', 'mesh-section');
    const body = sec.querySelector('.inspector-section-body');

    // Type
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
    sel.addEventListener('change', () => {
      mesh.type = sel.value;
      this.#editor.rebuildEntityObject(entityId);
    });
    typeRow.appendChild(sel);
    body.appendChild(typeRow);

    // Color
    const colorRow = document.createElement('div');
    colorRow.className = 'inspector-row';
    colorRow.innerHTML = '<span class="inspector-label">Color</span>';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'inspector-input';
    colorInput.value = colorToHex(mesh.color);
    colorInput.addEventListener('input', () => {
      mesh.color = hexToNum(colorInput.value);
      this.#editor.updateEntityColor(entityId, colorInput.value);
    });
    colorRow.appendChild(colorInput);
    body.appendChild(colorRow);

    return sec;
  }

  #buildLightSection(entityId, light) {
    const sec = this.#section('Light', 'light-section');
    const body = sec.querySelector('.inspector-section-body');

    // Type
    const typeRow = document.createElement('div');
    typeRow.className = 'inspector-row';
    typeRow.innerHTML = '<span class="inspector-label">Type</span>';
    const sel = document.createElement('select');
    sel.className = 'inspector-select';
    ['point','directional','spot'].forEach(t => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      if (t === light.type) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      light.type = sel.value;
      this.#editor.rebuildEntityObject(entityId);
    });
    typeRow.appendChild(sel);
    body.appendChild(typeRow);

    // Color
    const colorRow = document.createElement('div');
    colorRow.className = 'inspector-row';
    colorRow.innerHTML = '<span class="inspector-label">Color</span>';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'inspector-input';
    colorInput.value = colorToHex(light.color);
    colorInput.addEventListener('input', () => {
      light.color = hexToNum(colorInput.value);
      this.#editor.updateEntityLight(entityId);
    });
    colorRow.appendChild(colorInput);
    body.appendChild(colorRow);

    // Intensity
    const intRow = document.createElement('div');
    intRow.className = 'inspector-row';
    intRow.innerHTML = '<span class="inspector-label">Intensity</span>';
    const intField = document.createElement('div');
    intField.className = 'inspector-field';
    const intInp = numInput(light.intensity, (val) => {
      light.intensity = Math.max(0, val);
      this.#editor.updateEntityLight(entityId);
    }, 0.1);
    intField.appendChild(intInp);
    intRow.appendChild(intField);
    body.appendChild(intRow);

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
    sel.addEventListener('change', () => {
      trigger.type = sel.value;
      this.#editor.rebuildEntityObject(entityId);
    });
    typeRow.appendChild(sel);
    body.appendChild(typeRow);

    const sizeRow = document.createElement('div');
    sizeRow.className = 'inspector-row';
    sizeRow.innerHTML = '<span class="inspector-label">Size</span>';
    const sizeField = document.createElement('div');
    sizeField.className = 'inspector-field';
    const sizeInp = numInput(trigger.size, (val) => {
      trigger.size = Math.max(0.01, val);
      this.#editor.rebuildEntityObject(entityId);
    }, 0.1);
    sizeField.appendChild(sizeInp);
    sizeRow.appendChild(sizeField);
    body.appendChild(sizeRow);

    return sec;
  }

  #renderTransformValues() {
    const entityId = this.#editor.selectedEntityId;
    if (!entityId) return;
    const transform = this.#editor.world?.getComponent(entityId, TransformComponent);
    if (!transform) return;
    // Update position inputs without full re-render
    const axes = ['x','y','z'];
    const props = [
      { label: 'Position', vec: transform.position, mult: 1 },
      { label: 'Rotation', vec: transform.rotation, mult: 180/Math.PI },
      { label: 'Scale', vec: transform.scale, mult: 1 },
    ];
    for (const { label, vec, mult } of props) {
      for (const axis of axes) {
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
