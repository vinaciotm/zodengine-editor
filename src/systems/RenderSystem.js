import * as THREE from 'three/webgpu';
import { TransformComponent } from '../components/TransformComponent.js';
import { MeshComponent } from '../components/MeshComponent.js';
import { LightComponent } from '../components/LightComponent.js';
import { TriggerComponent } from '../components/TriggerComponent.js';
import { PlayerStartComponent } from '../components/PlayerStartComponent.js';
import { GroupComponent } from '../components/GroupComponent.js';
import { CameraComponent } from '../components/CameraComponent.js';
import { FogComponent } from '../components/FogComponent.js';

export class RenderSystem {
  world = null;
  scene = null;
  entityObjects = new Map();
  lightingEnabled = true;
  #parentCompClass = null;

  constructor(threeScene) {
    this.scene = threeScene;
  }

  setParentComponentClass(ParentComponent) {
    this.#parentCompClass = ParentComponent;
  }

  createObjectForEntity(entityId) {
    const existing = this.entityObjects.get(entityId);
    if (existing) {
      if (existing.parent) existing.parent.remove(existing);
      else this.scene.remove(existing);
    }
    const obj = this.#buildObject3D(entityId);
    obj.userData.entityId = entityId;
    this.scene.add(obj);
    this.entityObjects.set(entityId, obj);
    return obj;
  }

  removeObjectForEntity(entityId) {
    const obj = this.entityObjects.get(entityId);
    if (obj) {
      if (obj.userData.isFogEntity) this.scene.fog = null;
      if (obj.parent) obj.parent.remove(obj);
      else this.scene.remove(obj);
      this.entityObjects.delete(entityId);
    }
  }

  rebuildAll() {
    // Clear scene-level effects that are driven by entity components
    this.scene.fog = null;

    for (const obj of this.entityObjects.values()) {
      if (obj.parent) obj.parent.remove(obj);
      else this.scene.remove(obj);
    }
    this.entityObjects.clear();
    if (!this.world) return;

    for (const id of this.world.entities) {
      const obj = this.#buildObject3D(id);
      obj.userData.entityId = id;
      this.entityObjects.set(id, obj);
    }

    for (const id of this.world.entities) {
      const obj = this.entityObjects.get(id);
      if (!obj) continue;
      let parented = false;
      if (this.#parentCompClass) {
        const parentComp = this.world.getComponent(id, this.#parentCompClass);
        if (parentComp) {
          const parentObj = this.entityObjects.get(parentComp.parentId);
          if (parentObj) { parentObj.add(obj); parented = true; }
        }
      }
      if (!parented) this.scene.add(obj);
    }
  }

  getObject3D(entityId) { return this.entityObjects.get(entityId) ?? null; }

  setLightingEnabled(enabled) {
    this.lightingEnabled = enabled;
    for (const obj of this.entityObjects.values()) {
      obj.traverse(child => {
        if (child.isLight) child.visible = enabled;
      });
    }
    if (!enabled) this.scene.fog = null;
  }

  // Hide all editor-only visual indicators (sprites, line groups, range rings)
  hideEditorIcons() {
    for (const obj of this.entityObjects.values()) {
      obj.traverse(child => {
        if (child.userData.isEditorIcon) child.visible = false;
      });
    }
  }

  update() {
    for (const [entityId, obj] of this.entityObjects) {
      // Fog entities: update scene.fog from component values (only in lit mode)
      if (obj.userData.isFogEntity) {
        if (this.lightingEnabled) {
          const fog = this.world?.getComponent(entityId, FogComponent);
          if (fog) {
            if (this.scene.fog) {
              this.scene.fog.color.set(fog.color);
              this.scene.fog.near = fog.near;
              this.scene.fog.far = fog.far;
            } else {
              this.scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);
            }
          }
        } else {
          this.scene.fog = null;
        }
        continue;
      }

      const t = this.world?.getComponent(entityId, TransformComponent);
      if (t) {
        obj.position.copy(t.position);
        obj.rotation.copy(t.rotation);
        obj.scale.copy(t.scale);

        // Counter-scale editor icon children so scale gizmo doesn't distort them.
        // Sprites need their base scale restored; line/mesh debug groups keep world-unit size.
        const sx = Math.abs(t.scale.x) || 1;
        const sy = Math.abs(t.scale.y) || 1;
        const sz = Math.abs(t.scale.z) || 1;
        for (const child of obj.children) {
          if (!child.userData.isEditorIcon) continue;
          if (child.isSprite) {
            const base = child.userData.baseScale ?? 0.07;
            child.scale.set(base / sx, base / sy, 1);
          } else {
            child.scale.set(1 / sx, 1 / sy, 1 / sz);
          }
        }
      }
    }
  }

  #buildObject3D(entityId) {
    const w = this.world;
    const mesh = w?.getComponent(entityId, MeshComponent);
    const light = w?.getComponent(entityId, LightComponent);
    const trigger = w?.getComponent(entityId, TriggerComponent);
    const player = w?.getComponent(entityId, PlayerStartComponent);
    const group = w?.getComponent(entityId, GroupComponent);
    const camera = w?.getComponent(entityId, CameraComponent);
    const fog = w?.getComponent(entityId, FogComponent);

    if (group) return new THREE.Group();
    if (mesh) return this.#makeMesh(mesh);
    if (light) return this.#makeLight(light);
    if (camera) return this.#makeCamera(camera);
    if (trigger) return this.#makeTrigger(trigger);
    if (player) return this.#makePlayerStart();
    if (fog) {
      const marker = new THREE.Object3D();
      marker.userData.isFogEntity = true;
      this.scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);
      return marker;
    }
    return new THREE.Object3D();
  }

  #makeMesh(comp) {
    const geos = {
      box: () => new THREE.BoxGeometry(1, 1, 1),
      sphere: () => new THREE.SphereGeometry(0.5, 32, 32),
      cone: () => new THREE.ConeGeometry(0.5, 1, 32),
      cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
      capsule: () => new THREE.CapsuleGeometry(0.3, 0.6, 4, 16),
      plane: () => new THREE.PlaneGeometry(1, 1),
    };
    const geo = (geos[comp.type] ?? geos.box)();
    const base = { color: comp.color };
    let mat;
    switch (comp.materialType ?? 'standard') {
      case 'phong':
        mat = new THREE.MeshPhongMaterial({ ...base, shininess: comp.shininess ?? 30 });
        break;
      case 'lambert':
        mat = new THREE.MeshLambertMaterial(base);
        break;
      case 'basic':
        mat = new THREE.MeshBasicMaterial(base);
        break;
      case 'toon':
        mat = new THREE.MeshToonMaterial(base);
        break;
      default:
        mat = new THREE.MeshStandardMaterial({ ...base, roughness: comp.roughness ?? 0.5, metalness: comp.metalness ?? 0 });
    }
    if ((comp.opacity ?? 1) < 1) { mat.transparent = true; mat.opacity = comp.opacity; }
    if (comp.wireframe) mat.wireframe = true;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  #makeLight(comp) {
    const grp = new THREE.Group();

    // Ambient light: scene-wide, no position/shadow/sprite
    if (comp.type === 'ambient') {
      const light = new THREE.AmbientLight(comp.color, comp.intensity);
      grp.add(light);
      grp.userData.lightRef = light;
      return grp;
    }

    let light;

    switch (comp.type) {
      case 'directional': {
        light = new THREE.DirectionalLight(comp.color, comp.intensity);
        light.shadow.mapSize.setScalar(4096);
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = 100;
        light.shadow.camera.left = -15;
        light.shadow.camera.right = 15;
        light.shadow.camera.top = 15;
        light.shadow.camera.bottom = -15;
        light.shadow.bias = -0.0003;
        light.shadow.normalBias = 0.02;
        // Target inside group → light always shines downward and rotates with entity
        const dirTarget = new THREE.Object3D();
        dirTarget.position.set(0, -1, 0);
        grp.add(dirTarget);
        light.target = dirTarget;
        // Embedded debug: flat disc + 4 downward arrows (world-space size, counter-scaled in update)
        grp.add(this.#makeDirectionalDebug());
        break;
      }
      case 'spot': {
        light = new THREE.SpotLight(comp.color, comp.intensity);
        light.angle = Math.PI / 6;
        light.penumbra = 0.2;
        light.distance = comp.distance ?? 1;
        light.shadow.mapSize.setScalar(2048);
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = Math.max((comp.distance ?? 1) * 4, 20);
        light.shadow.bias = -0.0003;
        light.shadow.normalBias = 0.02;
        const spotTarget = new THREE.Object3D();
        spotTarget.position.set(0, -1, 0);
        grp.add(spotTarget);
        light.target = spotTarget;
        // Embedded cone wireframe
        grp.add(this.#makeSpotDebug(comp.distance ?? 1, Math.PI / 6));
        break;
      }
      default: {
        // PointLight: range rings embedded in group (3 orthogonal circles)
        light = new THREE.PointLight(comp.color, comp.intensity, comp.distance ?? 1, 2);
        light.shadow.mapSize.setScalar(2048);
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = Math.max((comp.distance ?? 1) * 4, 20);
        light.shadow.bias = -0.0003;
        light.shadow.normalBias = 0.02;
        const rings = this.#makePointLightRings(comp.distance ?? 1);
        grp.add(rings);
        grp.userData.rangeRingsRef = rings;
        break;
      }
    }

    light.castShadow = true;
    grp.add(light);
    grp.userData.lightRef = light;

    const sprite = this.#makeLightSprite(comp.type);
    sprite.userData.isEditorIcon = true;
    sprite.userData.baseScale = 0.07;
    grp.add(sprite);

    return grp;
  }

  // Three orthogonal wireframe circles: one horizontal (XZ) + two vertical (XY, YZ)
  #makePointLightRings(radius) {
    const grp = new THREE.Group();
    grp.userData.isEditorIcon = true;
    const N = 64;
    const mat = () => new THREE.LineBasicMaterial({
      color: 0xffcc44, transparent: true, opacity: 0.5, depthWrite: false,
    });

    const makeCircle = (axisA, axisB) => {
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const v = new THREE.Vector3();
        v[axisA] = Math.cos(a) * radius;
        v[axisB] = Math.sin(a) * radius;
        pts.push(v);
      }
      return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat());
    };

    grp.add(makeCircle('x', 'z')); // horizontal
    grp.add(makeCircle('x', 'y')); // vertical XY
    grp.add(makeCircle('y', 'z')); // vertical YZ
    return grp;
  }

  // Flat disc + 4 downward arrows indicating direction
  #makeDirectionalDebug() {
    const grp = new THREE.Group();
    grp.userData.isEditorIcon = true;
    const mat = () => new THREE.LineBasicMaterial({
      color: 0xffcc00, transparent: true, opacity: 0.5, depthWrite: false,
    });

    // Disc on XZ plane (radius 0.6)
    const R = 0.6, N = 32;
    const discPts = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      discPts.push(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R));
    }
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(discPts), mat()));

    // 4 downward arrows at compass points
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const ax = Math.cos(a) * R, az = Math.sin(a) * R;
      const shaft = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(ax, 0, az),
        new THREE.Vector3(ax, -1.2, az),
      ]), mat());
      grp.add(shaft);
    }
    return grp;
  }

  // Wireframe cone pointing downward (tip at origin)
  #makeSpotDebug(range, angle) {
    const grp = new THREE.Group();
    grp.userData.isEditorIcon = true;
    const mat = () => new THREE.LineBasicMaterial({
      color: 0xffaa44, transparent: true, opacity: 0.5, depthWrite: false,
    });

    const r = Math.max(range, 0.1) * Math.tan(angle);
    const N = 32;

    // Ring at cone base (below entity, in -Y direction)
    const ringPts = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(a) * r, -range, Math.sin(a) * r));
    }
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), mat()));

    // 4 lines from tip to ring
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.cos(a) * r, -range, Math.sin(a) * r),
      ]), mat()));
    }
    return grp;
  }

  #makeCamera(comp) {
    const grp = new THREE.Group();
    const cam = new THREE.PerspectiveCamera(comp.fov, 1, comp.near, comp.far);
    cam.updateProjectionMatrix();
    grp.add(cam);
    grp.userData.camRef = cam;

    const sprite = this.#makeCameraSprite();
    sprite.userData.isEditorIcon = true;
    sprite.userData.baseScale = 0.08;
    grp.add(sprite);

    return grp;
  }

  // Video/film camera sprite
  #makeCameraSprite() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2, cy = size / 2;

    const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, 52);
    glow.addColorStop(0, 'rgba(80,200,255,0.25)');
    glow.addColorStop(1, 'rgba(80,200,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI * 2); ctx.fill();

    // Camera body (wide horizontal — video camera)
    const bx = 18, by = 40, bw = 70, bh = 42;
    const bodyGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
    bodyGrad.addColorStop(0, '#5a9adc');
    bodyGrad.addColorStop(1, '#1a4a88');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill();
    ctx.strokeStyle = '#88ccff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.stroke();

    // Lens housing
    ctx.fillStyle = '#1a3a66';
    ctx.beginPath(); ctx.roundRect(78, 50, 22, 22, 4); ctx.fill();

    // Lens barrel
    const lcx = 91, lcy = 61;
    ctx.strokeStyle = '#44aadd'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(lcx, lcy, 11, 0, Math.PI * 2); ctx.stroke();
    const lensGrad = ctx.createRadialGradient(lcx - 3, lcy - 3, 1, lcx, lcy, 9);
    lensGrad.addColorStop(0, '#bbddff');
    lensGrad.addColorStop(0.4, '#2277bb');
    lensGrad.addColorStop(1, '#081828');
    ctx.fillStyle = lensGrad;
    ctx.beginPath(); ctx.arc(lcx, lcy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.ellipse(lcx - 3, lcy - 3, 3, 4, -0.4, 0, Math.PI * 2); ctx.fill();

    // Viewfinder eyepiece (left)
    ctx.fillStyle = '#2a5a99';
    ctx.beginPath(); ctx.roundRect(8, 46, 20, 11, 2); ctx.fill();
    ctx.strokeStyle = '#88ccff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(8, 46, 20, 11, 2); ctx.stroke();

    // Top handle
    ctx.fillStyle = '#2a5a99';
    ctx.beginPath(); ctx.roundRect(34, 28, 38, 14, 4); ctx.fill();
    ctx.strokeStyle = '#88ccff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(34, 28, 38, 14, 4); ctx.stroke();
    ctx.strokeStyle = 'rgba(136,204,255,0.4)'; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const hx = 40 + i * 9;
      ctx.beginPath(); ctx.moveTo(hx, 30); ctx.lineTo(hx, 40); ctx.stroke();
    }

    // Record indicator (red dot)
    ctx.fillStyle = '#ff3333';
    ctx.beginPath(); ctx.arc(cx - 2, 36, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,200,0.6)';
    ctx.beginPath(); ctx.arc(cx - 3, 35, 2, 0, Math.PI * 2); ctx.fill();

    // Tally light
    ctx.fillStyle = '#ff4444';
    ctx.beginPath(); ctx.arc(26, 48, 3, 0, Math.PI * 2); ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture, sizeAttenuation: false, depthTest: true, transparent: true, opacity: 0.5,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.08, 0.08, 1);
    return sprite;
  }

  #makeLightSprite(type) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2, cy = size / 2;
    ctx.clearRect(0, 0, size, size);

    if (type === 'directional') {
      // Sun — centered at canvas center = entity position
      const rayLen = 22, rayWidth = 4, innerR = 22;
      const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 48);
      glow.addColorStop(0, 'rgba(255,200,50,0.35)');
      glow.addColorStop(1, 'rgba(255,200,50,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, 48, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = rayWidth; ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const x1 = cx + Math.cos(angle) * (innerR + 4);
        const y1 = cy + Math.sin(angle) * (innerR + 4);
        const x2 = cx + Math.cos(angle) * (innerR + rayLen);
        const y2 = cy + Math.sin(angle) * (innerR + rayLen);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      ctx.restore();
      const sunGrad = ctx.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, innerR);
      sunGrad.addColorStop(0, '#fff8cc');
      sunGrad.addColorStop(0.4, '#ffdd00');
      sunGrad.addColorStop(1, '#ff8800');
      ctx.fillStyle = sunGrad;
      ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(cx - 7, cy - 7, 8, 0, Math.PI * 2); ctx.fill();

    } else if (type === 'spot') {
      // Spotlight — tip (lens) at canvas center = entity position
      const glow = ctx.createRadialGradient(cx, cy, 5, cx, cy + 20, 55);
      glow.addColorStop(0, 'rgba(255,200,100,0.3)');
      glow.addColorStop(1, 'rgba(255,150,50,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy + 20, 50, 0, Math.PI * 2); ctx.fill();

      const coneTopY = cy;      // entity position = canvas center
      const coneBot = cy + 50;  // cone extends below
      const coneW = 34;
      const beamGrad = ctx.createLinearGradient(cx, coneTopY, cx, coneBot);
      beamGrad.addColorStop(0, 'rgba(255,220,80,0.7)');
      beamGrad.addColorStop(1, 'rgba(255,180,50,0.05)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(cx, coneTopY);
      ctx.lineTo(cx - coneW, coneBot);
      ctx.lineTo(cx + coneW, coneBot);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,80,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, coneTopY); ctx.lineTo(cx - coneW, coneBot);
      ctx.moveTo(cx, coneTopY); ctx.lineTo(cx + coneW, coneBot);
      ctx.stroke();

      // Housing above center
      const hw = 28, hh = 18, hr = 4;
      const hx = cx - hw / 2, hy = coneTopY - hh;
      const housingGrad = ctx.createLinearGradient(hx, 0, hx + hw, 0);
      housingGrad.addColorStop(0, '#444');
      housingGrad.addColorStop(0.5, '#888');
      housingGrad.addColorStop(1, '#333');
      ctx.fillStyle = housingGrad;
      ctx.beginPath(); ctx.roundRect(hx, hy, hw, hh, hr); ctx.fill();

      // Lens at entity position (canvas center)
      const lensGrad = ctx.createRadialGradient(cx - 3, coneTopY - 2, 1, cx, coneTopY, 10);
      lensGrad.addColorStop(0, '#ffffff');
      lensGrad.addColorStop(0.3, '#fff8cc');
      lensGrad.addColorStop(0.7, '#ffcc44');
      lensGrad.addColorStop(1, '#ff8800');
      ctx.fillStyle = lensGrad;
      ctx.beginPath(); ctx.arc(cx, coneTopY, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, coneTopY, 10, 0, Math.PI * 2); ctx.stroke();

      // Mount above housing
      ctx.fillStyle = '#555';
      ctx.fillRect(cx - 4, hy - 8, 8, 10);
      ctx.beginPath(); ctx.arc(cx, hy - 8, 4, 0, Math.PI * 2); ctx.fill();

    } else {
      // Point light bulb — centered at canvas center = entity position
      const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, 52);
      glow.addColorStop(0, 'rgba(255,240,100,0.4)');
      glow.addColorStop(1, 'rgba(255,240,100,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI * 2); ctx.fill();

      const bulbGrad = ctx.createRadialGradient(cx - 8, cy - 8, 2, cx, cy, 22);
      bulbGrad.addColorStop(0, '#fffde0');
      bulbGrad.addColorStop(0.35, '#ffe566');
      bulbGrad.addColorStop(0.7, '#ffb700');
      bulbGrad.addColorStop(1, '#ff8000');
      ctx.fillStyle = bulbGrad;
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();

      // Filament
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + 8); ctx.lineTo(cx - 6, cy - 4);
      ctx.lineTo(cx, cy - 10); ctx.lineTo(cx + 6, cy - 4); ctx.lineTo(cx + 6, cy + 8);
      ctx.stroke();

      // Base below bulb
      const baseGrad = ctx.createLinearGradient(cx - 12, 0, cx + 12, 0);
      baseGrad.addColorStop(0, '#666'); baseGrad.addColorStop(0.5, '#aaa'); baseGrad.addColorStop(1, '#555');
      ctx.fillStyle = baseGrad;
      ctx.beginPath(); ctx.roundRect(cx - 11, cy + 21, 22, 7, 2); ctx.fill();
      ctx.fillRect(cx - 7, cy + 28, 14, 4);
      ctx.fillRect(cx - 5, cy + 32, 10, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.ellipse(cx - 7, cy - 8, 5, 8, -0.4, 0, Math.PI * 2); ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture, sizeAttenuation: false, depthTest: true, transparent: true, opacity: 0.5,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.07, 0.07, 1);
    return sprite;
  }

  #makeTrigger(comp) {
    const geo = comp.type === 'sphere'
      ? new THREE.SphereGeometry(comp.size * 0.5, 16, 16)
      : new THREE.BoxGeometry(comp.size, comp.size, comp.size);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true, transparent: true, opacity: 0.6 });
    return new THREE.Mesh(geo, mat);
  }

  #makePlayerStart() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 0.8, 4, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
    );
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.4, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    arrow.position.y = 1.0;
    group.add(body, arrow);
    return group;
  }
}
