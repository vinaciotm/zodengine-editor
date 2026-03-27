import * as THREE from 'three/webgpu';
import { numInput, dragNum, colorToHex, hexToNum, makeCollapsiblePanel } from './utils.js';
import { sfx } from './sfx.js';
import { getEntityIconType, iconURL } from './entityIcons.js';
import { TagComponent } from '../components/TagComponent.js';
import { TransformCommand } from '../editor/CommandManager.js';
import { TransformComponent } from '../components/TransformComponent.js';
import { MeshComponent } from '../components/MeshComponent.js';
import { LightComponent } from '../components/LightComponent.js';
import { TriggerComponent } from '../components/TriggerComponent.js';
import { ParentComponent } from '../components/ParentComponent.js';
import { CameraComponent } from '../components/CameraComponent.js';
import { FogComponent } from '../components/FogComponent.js';
import { SkyBoxComponent } from '../components/SkyBoxComponent.js';

export class InspectorPanel {
  #el = null;
  #editor = null;
  #unsubs = [];

  constructor(editor) { this.#editor = editor; }

  #contentEl = null;

  mount(parent) {
    this.#el = document.createElement('div');
    this.#el.className = 'panel';
    this.#el.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;';
    parent.appendChild(this.#el);

    // Persistent header (survives re-renders)
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = '<span class="ph-icon">&#9881;</span><span class="ph-text"> Propriedades</span>';
    this.#el.appendChild(header);

    this.#contentEl = document.createElement('div');
    this.#contentEl.className = 'panel-content';
    this.#contentEl.id = 'insp-content';
    this.#el.appendChild(this.#contentEl);

    makeCollapsiblePanel(header, this.#contentEl, true, open => open ? sfx.in() : sfx.out());

    this.#render();
    this.#unsubs.push(
      this.#editor.on('entity:selected', () => {
        if (this.#editor.selectedEntityId !== null && this.#contentEl.style.display === 'none') header.click();
        this.#render();
      }),
      this.#editor.on('entity:changed', () => this.#renderTransformValues()),
      this.#editor.on('scene:switched', () => this.#render()),
      this.#editor.on('scenes:changed', () => {
        if (this.#editor.selectedEntityId === null) this.#render();
      }),
    );
  }

  destroy() {
    this.#unsubs.forEach(u => u());
    this.#el?.remove();
  }

  #render() {
    const content = this.#contentEl;
    if (!content) return;
    content.innerHTML = '';
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
      badge.style.cssText = 'padding:2px 8px;font-size:10px;color:var(--accent2);background:var(--bg-dark);border-bottom:1px solid var(--border);';
      badge.textContent = `↳ Child of: ${parentTag?.name ?? 'Group'} (local coords)`;
      content.appendChild(badge);
    }

    // Name row with icon
    const tag = world.getComponent(entityId, TagComponent);
    if (tag) {
      const nameRow = document.createElement('div');
      nameRow.className = 'inspector-name-row';
      const iconType = getEntityIconType(entityId, world);
      if (iconType) {
        const iconEl = document.createElement('img');
        iconEl.src = iconURL(iconType);
        iconEl.width = 18; iconEl.height = 18;
        iconEl.style.cssText = 'flex-shrink:0;opacity:0.9;';
        nameRow.appendChild(iconEl);
      }
      const nameInput = document.createElement('input');
      nameInput.className = 'inspector-name-input';
      nameInput.value = tag.name;
      nameInput.placeholder = 'Entity name';
      nameInput.addEventListener('change', () => {
        this.#editor.renameEntity(entityId, nameInput.value.trim() || 'Entity');
      });
      nameRow.appendChild(nameInput);
      content.appendChild(nameRow);
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

    // SkyBox
    const sky = world.getComponent(entityId, SkyBoxComponent);
    if (sky) content.appendChild(this.#buildSkyBoxSection(entityId, sky));

    // Trigger
    const trigger = world.getComponent(entityId, TriggerComponent);
    if (trigger) content.appendChild(this.#buildTriggerSection(entityId, trigger));
  }

  #renderSceneSettings(content) {
    const name = this.#editor.getSceneName();
    const bg   = this.#editor.getSceneBackground();

    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:8px 12px;';

    const heading = (text) => {
      const el = document.createElement('div');
      el.style.cssText = 'font-size:10px;text-transform:uppercase;color:var(--text-muted,#888);letter-spacing:0.5px;margin:10px 0 6px;';
      el.textContent = text;
      wrap.appendChild(el);
    };
    const mkRow = (labelText) => {
      const row = document.createElement('div');
      row.className = 'inspector-row';
      row.innerHTML = `<span class="inspector-label">${labelText}</span>`;
      wrap.appendChild(row);
      return row;
    };
    const mkSel = (options, currentVal, onChange) => {
      const sel = document.createElement('select');
      sel.className = 'inspector-select';
      for (const [val, lbl] of options) {
        const opt = document.createElement('option');
        opt.value = val; opt.textContent = lbl;
        if (val === String(currentVal)) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => onChange(sel.value));
      return sel;
    };

    heading('Scene');
    const nameRow = mkRow('Name');
    const nameInp = document.createElement('input');
    nameInp.className = 'inspector-input';
    nameInp.value = name; nameInp.style.flex = '1';
    nameInp.addEventListener('change', () => this.#editor.renameScene(this.#editor.currentSceneIndex, nameInp.value.trim() || name));
    nameRow.appendChild(nameInp);

    const bgRow = mkRow('Background');
    bgRow.style.marginTop = '4px';
    const bgInp = document.createElement('input');
    bgInp.type = 'color'; bgInp.className = 'inspector-input'; bgInp.value = bg;
    bgInp.style.cssText = 'width:44px;padding:1px 2px;height:24px;cursor:pointer;';
    bgInp.addEventListener('input', () => this.#editor.setSceneBackground(bgInp.value));
    bgRow.appendChild(bgInp);

    heading('Rendering');
    const tmRow = mkRow('ToneMap');
    const TM = THREE;
    const tmOptions = [
      [String(TM.ReinhardToneMapping),    'Reinhard'],
      [String(TM.ACESFilmicToneMapping),  'ACES Filmic'],
      [String(TM.LinearToneMapping),      'Linear'],
      [String(TM.CineonToneMapping),      'Cineon'],
      [String(TM.AgXToneMapping ?? 7),    'AgX'],
      [String(TM.NoToneMapping),          'None'],
    ];
    const tmSel = mkSel(tmOptions, this.#editor.getToneMapping(), (v) => this.#editor.setToneMapping(Number(v)));
    tmRow.appendChild(tmSel);

    heading('Environment');
    const envRow = mkRow('Preset');
    const envOptions = [
      ['none','None'],['forest','Forest'],['dawn','Dawn'],
      ['studio','Studio'],['sunset','Sunset'],['overcast','Overcast'],
    ];
    const currentEnv = this.#editor.getEnvironmentPreset?.() ?? 'none';
    const envSel = mkSel(envOptions, currentEnv, (v) => this.#editor.setEnvironmentPreset(v));
    envRow.appendChild(envSel);

    const blurRow = mkRow('Blur');
    blurRow.style.marginTop = '4px';
    const blurWrap = document.createElement('div');
    blurWrap.style.cssText = 'display:flex;align-items:center;gap:6px;flex:1;';
    const blurSlider = document.createElement('input');
    blurSlider.type = 'range'; blurSlider.min = '0'; blurSlider.max = '1'; blurSlider.step = '0.01';
    blurSlider.value = String(this.#editor.getEnvironmentBlur());
    blurSlider.style.flex = '1';
    const blurVal = document.createElement('span');
    blurVal.style.cssText = 'font-size:10px;color:var(--text-muted,#888);min-width:28px;';
    blurVal.textContent = blurSlider.value;
    blurSlider.addEventListener('input', () => {
      blurVal.textContent = blurSlider.value;
      this.#editor.setEnvironmentBlur(parseFloat(blurSlider.value));
    });
    blurWrap.appendChild(blurSlider);
    blurWrap.appendChild(blurVal);
    blurRow.appendChild(blurWrap);

    content.appendChild(wrap);
  }

  #buildTransformSection(entityId, transform) {
    const sec = this.#section('Transform', 'transform-section');
    const body = sec.querySelector('.inspector-section-body');
    body.style.padding = '4px 0 8px';

    const makeVec3Block = (label, getVal, setVal, step = 0.01, onDragStart, onCommit) => {
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

        const dn = dragNum(getVal(axis), (val) => { setVal(axis, val); }, step,
          { onDragStart, onCommit });
        dn.querySelector('input').dataset.vecAxis = `${label}-${axis}`;

        wrap.appendChild(axlbl);
        wrap.appendChild(dn);
        row.appendChild(wrap);
      });

      group.appendChild(row);
      return group;
    };

    const sync = () => this.#editor.emit('entity:changed', entityId);

    // Undo/redo support: capture snapshot before drag, push command on commit
    const snapTransform = () => ({
      position: transform.position.clone(),
      rotation: transform.rotation.clone(),
      scale: transform.scale.clone(),
    });
    let _before = null;
    const onDragStart = () => { if (!_before) _before = snapTransform(); };
    const onCommit = () => {
      if (_before) {
        const after = snapTransform();
        this.#editor.commandManager.push(new TransformCommand(this.#editor, entityId, _before, after));
        _before = null;
      }
    };

    body.appendChild(makeVec3Block('Position',
      axis => transform.position[axis],
      (axis, val) => { transform.position[axis] = val; sync(); },
      0.01, onDragStart, onCommit
    ));
    const isRotationLocked = this.#editor.isRotationLocked(entityId);
    if (!isRotationLocked) {
      body.appendChild(makeVec3Block('Rotation',
        axis => transform.rotation[axis] * 180 / Math.PI,
        (axis, val) => { transform.rotation[axis] = val * Math.PI / 180; sync(); },
        1, onDragStart, onCommit
      ));
    }
    // Scale is hidden for cameras and lights (not applicable)
    const isScaleLocked = this.#editor.isScaleLocked(entityId);
    if (!isScaleLocked) {
      body.appendChild(makeVec3Block('Scale',
        axis => transform.scale[axis],
        (axis, val) => { transform.scale[axis] = val; sync(); },
        0.01, onDragStart, onCommit
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
    ['box','sphere','cone','cylinder','capsule','plane','ramp','barrel','tunnel','terrain'].forEach(t => {
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

    // Texture select
    const texRow = document.createElement('div');
    texRow.className = 'inspector-row';
    texRow.innerHTML = '<span class="inspector-label">Texture</span>';
    const texSel = document.createElement('select');
    texSel.className = 'inspector-select';
    ['checker','none'].forEach(t => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t === 'checker' ? 'Checker' : 'None';
      if ((mesh.texture ?? 'checker') === t) opt.selected = true;
      texSel.appendChild(opt);
    });
    texSel.addEventListener('change', () => { mesh.texture = texSel.value; this.#editor.rebuildEntityObject(entityId); });
    texRow.appendChild(texSel);
    body.appendChild(texRow);

    // Material type
    const matRow = document.createElement('div');
    matRow.className = 'inspector-row';
    matRow.innerHTML = '<span class="inspector-label">Material</span>';
    const matSel = document.createElement('select');
    matSel.className = 'inspector-select';
    ['standard','phong','lambert','basic','toon'].forEach(t => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      if ((mesh.materialType ?? 'standard') === t) opt.selected = true;
      matSel.appendChild(opt);
    });
    matRow.appendChild(matSel);
    body.appendChild(matRow);

    // Material config container (rebuilt on type change)
    const matConfig = document.createElement('div');
    body.appendChild(matConfig);

    const buildMatConfig = (type) => {
      matConfig.innerHTML = '';
      const mkRow = (label, get, set, step = 0.01) => {
        const r = document.createElement('div');
        r.className = 'inspector-row';
        r.innerHTML = `<span class="inspector-label">${label}</span>`;
        const f = document.createElement('div');
        f.className = 'inspector-field-axis';
        f.appendChild(dragNum(get(), (val) => { set(val); this.#editor.rebuildEntityObject(entityId); }, step));
        r.appendChild(f);
        matConfig.appendChild(r);
      };
      if (type === 'standard') {
        mkRow('Roughness', () => mesh.roughness ?? 0.5, v => { mesh.roughness = Math.max(0, Math.min(1, v)); }, 0.01);
        mkRow('Metalness', () => mesh.metalness ?? 0,   v => { mesh.metalness = Math.max(0, Math.min(1, v)); }, 0.01);
      } else if (type === 'phong') {
        mkRow('Shininess', () => mesh.shininess ?? 30,  v => { mesh.shininess = Math.max(0, v); }, 1);
      }
      // Wireframe
      const wfRow = document.createElement('div');
      wfRow.className = 'inspector-row';
      wfRow.innerHTML = '<span class="inspector-label">Wireframe</span>';
      const wfCb = document.createElement('input');
      wfCb.type = 'checkbox';
      wfCb.checked = mesh.wireframe ?? false;
      wfCb.addEventListener('change', () => { mesh.wireframe = wfCb.checked; this.#editor.rebuildEntityObject(entityId); });
      wfRow.appendChild(wfCb);
      matConfig.appendChild(wfRow);
      // Opacity
      mkRow('Opacity', () => mesh.opacity ?? 1, v => { mesh.opacity = Math.max(0, Math.min(1, v)); }, 0.01);
    };

    buildMatConfig(mesh.materialType ?? 'standard');
    matSel.addEventListener('change', () => {
      mesh.materialType = matSel.value;
      buildMatConfig(mesh.materialType);
      this.#editor.rebuildEntityObject(entityId);
    });

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
    intField.appendChild(dragNum(light.intensity, (val) => { light.intensity = Math.max(0, val); this.#editor.updateEntityLight(entityId); }, 0.1));
    intRow.appendChild(intField);
    body.appendChild(intRow);

    // Range (distance) — only relevant for point and spot
    if (light.type === 'point' || light.type === 'spot') {
      const distRow = document.createElement('div');
      distRow.className = 'inspector-row';
      distRow.innerHTML = '<span class="inspector-label">Range</span>';
      const distField = document.createElement('div');
      distField.className = 'inspector-field-axis';
      distField.appendChild(dragNum(light.distance ?? 10, (val) => {
        light.distance = Math.max(0.1, val);
        this.#editor.updateEntityLight(entityId);
      }, 0.5));
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
    fovField.appendChild(dragNum(camera.fov, (val) => {
      camera.fov = Math.max(10, Math.min(170, val));
      this.#editor.updateEntityCamera(entityId);
    }, 1));
    fovRow.appendChild(fovField);
    body.appendChild(fovRow);

    const nearRow = document.createElement('div');
    nearRow.className = 'inspector-row';
    nearRow.innerHTML = '<span class="inspector-label">Near</span>';
    const nearField = document.createElement('div');
    nearField.className = 'inspector-field-axis';
    nearField.appendChild(dragNum(camera.near, (val) => {
      camera.near = Math.max(0.001, val);
      this.#editor.updateEntityCamera(entityId);
    }, 0.01));
    nearRow.appendChild(nearField);
    body.appendChild(nearRow);

    const farRow = document.createElement('div');
    farRow.className = 'inspector-row';
    farRow.innerHTML = '<span class="inspector-label">Far</span>';
    const farField = document.createElement('div');
    farField.className = 'inspector-field-axis';
    farField.appendChild(dragNum(camera.far, (val) => {
      camera.far = Math.max(1, val);
      this.#editor.updateEntityCamera(entityId);
    }, 10));
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
    sizeField.appendChild(dragNum(trigger.size, (val) => { trigger.size = Math.max(0.01, val); this.#editor.rebuildEntityObject(entityId); }, 0.1));
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
      field.appendChild(dragNum(get(), set, step));
      row.appendChild(field);
      body.appendChild(row);
    };
    mkRow('Near', () => fog.near, v => { fog.near = Math.max(0, v); }, 0.5);
    mkRow('Far',  () => fog.far,  v => { fog.far  = Math.max(fog.near + 0.1, v); }, 1);

    return sec;
  }

  #buildSkyBoxSection(entityId, sky) {
    const sec = this.#section('SkyBox', 'skybox-section');
    const body = sec.querySelector('.inspector-section-body');

    const mkRow = (label, get, set, step, min, max) => {
      const row = document.createElement('div');
      row.className = 'inspector-row';
      row.innerHTML = `<span class="inspector-label">${label}</span>`;
      const field = document.createElement('div');
      field.className = 'inspector-field-axis';
      field.appendChild(dragNum(get(), v => set(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v))), step));
      row.appendChild(field);
      body.appendChild(row);
    };

    mkRow('Turbidity',     () => sky.turbidity,        v => { sky.turbidity = v; },        0.1, 0, 20);
    mkRow('Rayleigh',      () => sky.rayleigh,          v => { sky.rayleigh = v; },          0.01, 0, 4);
    mkRow('Mie Coeff',     () => sky.mieCoefficient,    v => { sky.mieCoefficient = v; },    0.0001, 0, 0.1);
    mkRow('Mie Dir G',     () => sky.mieDirectionalG,   v => { sky.mieDirectionalG = v; },   0.01, 0, 1);
    mkRow('Elevation',     () => sky.elevation,         v => { sky.elevation = v; },         0.1, -90, 90);
    mkRow('Azimuth',       () => sky.azimuth,           v => { sky.azimuth = v; },           1, 0, 360);
    mkRow('Exposure',      () => sky.exposure,          v => { sky.exposure = v; },          0.01, 0, 2);
    mkRow('Cloud Cover',   () => sky.cloudCoverage,     v => { sky.cloudCoverage = v; },     0.01, 0, 1);
    mkRow('Cloud Density', () => sky.cloudDensity,      v => { sky.cloudDensity = v; },      0.01, 0, 1);
    mkRow('Cloud Elev',    () => sky.cloudElevation,    v => { sky.cloudElevation = v; },    0.01, 0, 1);

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
