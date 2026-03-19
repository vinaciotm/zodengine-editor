import * as THREE from 'three';
import { TransformComponent } from '../components/TransformComponent.js';
import { MeshComponent } from '../components/MeshComponent.js';
import { LightComponent } from '../components/LightComponent.js';
import { TriggerComponent } from '../components/TriggerComponent.js';
import { PlayerStartComponent } from '../components/PlayerStartComponent.js';
import { GroupComponent } from '../components/GroupComponent.js';
import { CameraComponent } from '../components/CameraComponent.js';

export class RenderSystem {
  world = null;
  scene = null;
  entityObjects = new Map();
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
      if (obj.parent) obj.parent.remove(obj);
      else this.scene.remove(obj);
      this.entityObjects.delete(entityId);
    }
  }

  rebuildAll() {
    for (const obj of this.entityObjects.values()) {
      if (obj.parent) obj.parent.remove(obj);
      else this.scene.remove(obj);
    }
    this.entityObjects.clear();
    if (!this.world) return;

    // First pass: create all objects
    for (const id of this.world.entities) {
      const obj = this.#buildObject3D(id);
      obj.userData.entityId = id;
      this.entityObjects.set(id, obj);
    }

    // Second pass: handle parent-child
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

  update() {
    for (const [entityId, obj] of this.entityObjects) {
      const t = this.world?.getComponent(entityId, TransformComponent);
      if (t) {
        obj.position.copy(t.position);
        obj.rotation.copy(t.rotation);
        obj.scale.copy(t.scale);
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

    if (group) return new THREE.Group();
    if (mesh) return this.#makeMesh(mesh);
    if (light) return this.#makeLight(light);
    if (camera) return this.#makeCamera(camera);
    if (trigger) return this.#makeTrigger(trigger);
    if (player) return this.#makePlayerStart();
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
    const mat = new THREE.MeshStandardMaterial({ color: comp.color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  #makeLight(comp) {
    const grp = new THREE.Group();
    let light;

    switch (comp.type) {
      case 'directional':
        light = new THREE.DirectionalLight(comp.color, comp.intensity);
        break;
      case 'spot':
        light = new THREE.SpotLight(comp.color, comp.intensity);
        light.angle = Math.PI / 6;
        light.penumbra = 0.2;
        break;
      default:
        light = new THREE.PointLight(comp.color, comp.intensity);
        break;
    }

    light.castShadow = true;
    grp.add(light);
    grp.userData.lightRef = light;

    const sprite = this.#makeLightSprite(comp.type);
    sprite.userData.isEditorIcon = true;
    grp.add(sprite);

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
    grp.add(sprite);

    return grp;
  }

  #makeCameraSprite() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2, cy = size / 2;
    ctx.clearRect(0, 0, size, size);

    // Outer glow
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 52);
    glow.addColorStop(0, 'rgba(80,200,255,0.3)');
    glow.addColorStop(1, 'rgba(80,200,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI * 2); ctx.fill();

    // Camera body
    const bw = 66, bh = 38, br = 5;
    const bx = cx - bw / 2, by = cy - 8;
    const bodyGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
    bodyGrad.addColorStop(0, '#4a90cc');
    bodyGrad.addColorStop(1, '#1a4a88');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, br); ctx.fill();
    ctx.strokeStyle = '#88ccff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, br); ctx.stroke();

    // Viewfinder bump on top
    const vfw = 22, vfh = 12;
    const vfx = cx - vfw / 2, vfy = by - vfh + 2;
    ctx.fillStyle = '#2a6aaa';
    ctx.beginPath(); ctx.roundRect(vfx, vfy, vfw, vfh, 3); ctx.fill();
    ctx.strokeStyle = '#88ccff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(vfx, vfy, vfw, vfh, 3); ctx.stroke();

    // Shutter button
    ctx.fillStyle = '#88bbdd';
    ctx.beginPath(); ctx.arc(cx + 20, vfy + 5, 5, 0, Math.PI * 2); ctx.fill();

    // Lens outer ring
    const lcx = cx, lcy = cy + 8;
    ctx.strokeStyle = '#55aadd'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(lcx, lcy, 17, 0, Math.PI * 2); ctx.stroke();

    // Lens body
    const lensGrad = ctx.createRadialGradient(lcx - 5, lcy - 5, 2, lcx, lcy, 14);
    lensGrad.addColorStop(0, '#aaddff');
    lensGrad.addColorStop(0.35, '#3388cc');
    lensGrad.addColorStop(1, '#0a1a33');
    ctx.fillStyle = lensGrad;
    ctx.beginPath(); ctx.arc(lcx, lcy, 14, 0, Math.PI * 2); ctx.fill();

    // Lens shine
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(lcx - 5, lcy - 4, 4, 6, -0.4, 0, Math.PI * 2); ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, sizeAttenuation: false, depthTest: true, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.07, 0.07, 1);
    return sprite;
  }

  #makeLightSprite(type) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;

    ctx.clearRect(0, 0, size, size);

    if (type === 'directional') {
      const rayLen = 22, rayWidth = 4, innerR = 22;
      const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 48);
      glow.addColorStop(0, 'rgba(255,200,50,0.35)');
      glow.addColorStop(1, 'rgba(255,200,50,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, 48, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = rayWidth;
      ctx.lineCap = 'round';
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
      const glow = ctx.createRadialGradient(cx, cy - 20, 5, cx, cy, 55);
      glow.addColorStop(0, 'rgba(255,200,100,0.3)');
      glow.addColorStop(1, 'rgba(255,150,50,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, 55, 0, Math.PI * 2); ctx.fill();
      const coneTop = cy - 14;
      const coneBot = cy + 48;
      const coneW = 38;
      const beamGrad = ctx.createLinearGradient(cx, coneTop, cx, coneBot);
      beamGrad.addColorStop(0, 'rgba(255,220,80,0.7)');
      beamGrad.addColorStop(1, 'rgba(255,180,50,0.05)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(cx, coneTop);
      ctx.lineTo(cx - coneW, coneBot);
      ctx.lineTo(cx + coneW, coneBot);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,80,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, coneTop); ctx.lineTo(cx - coneW, coneBot);
      ctx.moveTo(cx, coneTop); ctx.lineTo(cx + coneW, coneBot);
      ctx.stroke();
      const hw = 30, hh = 20, hr = 5;
      const hx = cx - hw / 2, hy = cy - 36;
      const housingGrad = ctx.createLinearGradient(hx, 0, hx + hw, 0);
      housingGrad.addColorStop(0, '#444');
      housingGrad.addColorStop(0.5, '#888');
      housingGrad.addColorStop(1, '#333');
      ctx.fillStyle = housingGrad;
      ctx.beginPath(); ctx.roundRect(hx, hy, hw, hh, hr); ctx.fill();
      const lensGrad = ctx.createRadialGradient(cx - 3, coneTop - 2, 1, cx, coneTop, 11);
      lensGrad.addColorStop(0, '#ffffff');
      lensGrad.addColorStop(0.3, '#fff8cc');
      lensGrad.addColorStop(0.7, '#ffcc44');
      lensGrad.addColorStop(1, '#ff8800');
      ctx.fillStyle = lensGrad;
      ctx.beginPath(); ctx.arc(cx, coneTop, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, coneTop, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#555';
      ctx.fillRect(cx - 4, hy - 8, 8, 10);
      ctx.beginPath(); ctx.arc(cx, hy - 8, 4, 0, Math.PI * 2); ctx.fill();

    } else {
      const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, 52);
      glow.addColorStop(0, 'rgba(255,240,100,0.4)');
      glow.addColorStop(1, 'rgba(255,240,100,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI * 2); ctx.fill();
      const bulbGrad = ctx.createRadialGradient(cx - 8, cy - 8, 2, cx, cy, 24);
      bulbGrad.addColorStop(0, '#fffde0');
      bulbGrad.addColorStop(0.35, '#ffe566');
      bulbGrad.addColorStop(0.7, '#ffb700');
      bulbGrad.addColorStop(1, '#ff8000');
      ctx.fillStyle = bulbGrad;
      ctx.beginPath(); ctx.arc(cx, cy - 4, 24, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + 6); ctx.lineTo(cx - 6, cy - 6);
      ctx.lineTo(cx, cy - 12);
      ctx.lineTo(cx + 6, cy - 6); ctx.lineTo(cx + 6, cy + 6);
      ctx.stroke();
      const baseGrad = ctx.createLinearGradient(cx - 12, 0, cx + 12, 0);
      baseGrad.addColorStop(0, '#666');
      baseGrad.addColorStop(0.5, '#aaa');
      baseGrad.addColorStop(1, '#555');
      ctx.fillStyle = baseGrad;
      ctx.beginPath(); ctx.roundRect(cx - 12, cy + 19, 24, 8, 2); ctx.fill();
      ctx.fillRect(cx - 8, cy + 27, 16, 4);
      ctx.fillRect(cx - 6, cy + 31, 12, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.ellipse(cx - 8, cy - 10, 6, 9, -0.4, 0, Math.PI * 2); ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      sizeAttenuation: false,
      depthTest: true,
      transparent: true,
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
