import * as THREE from 'three';
import { TransformComponent } from '../components/TransformComponent.js';
import { MeshComponent } from '../components/MeshComponent.js';
import { LightComponent } from '../components/LightComponent.js';
import { TriggerComponent } from '../components/TriggerComponent.js';
import { PlayerStartComponent } from '../components/PlayerStartComponent.js';

export class RenderSystem {
  world = null;
  scene = null;
  entityObjects = new Map();

  constructor(threeScene) {
    this.scene = threeScene;
  }

  createObjectForEntity(entityId) {
    const existing = this.entityObjects.get(entityId);
    if (existing) { this.scene.remove(existing); }

    const obj = this.#buildObject3D(entityId);
    obj.userData.entityId = entityId;
    this.scene.add(obj);
    this.entityObjects.set(entityId, obj);
    return obj;
  }

  removeObjectForEntity(entityId) {
    const obj = this.entityObjects.get(entityId);
    if (obj) { this.scene.remove(obj); this.entityObjects.delete(entityId); }
  }

  rebuildAll() {
    for (const obj of this.entityObjects.values()) this.scene.remove(obj);
    this.entityObjects.clear();
    if (!this.world) return;
    for (const id of this.world.entities) this.createObjectForEntity(id);
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

    if (mesh) return this.#makeMesh(mesh);
    if (light) return this.#makeLight(light);
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
    return new THREE.Mesh(geo, mat);
  }

  #makeLight(comp) {
    const group = new THREE.Group();
    let light;
    switch (comp.type) {
      case 'directional':
        light = new THREE.DirectionalLight(comp.color, comp.intensity);
        group.add(new THREE.DirectionalLightHelper(light, 1));
        break;
      case 'spot':
        light = new THREE.SpotLight(comp.color, comp.intensity);
        group.add(new THREE.SpotLightHelper(light));
        break;
      default:
        light = new THREE.PointLight(comp.color, comp.intensity);
        group.add(new THREE.PointLightHelper(light, 0.5));
    }
    group.add(light);
    group.userData.lightRef = light;
    return group;
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
