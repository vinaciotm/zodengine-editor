import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { World } from '../ecs/World.js';
import { RenderSystem } from '../systems/RenderSystem.js';
import { TagComponent } from '../components/TagComponent.js';
import { TransformComponent } from '../components/TransformComponent.js';
import { MeshComponent } from '../components/MeshComponent.js';
import { LightComponent } from '../components/LightComponent.js';
import { TriggerComponent } from '../components/TriggerComponent.js';
import { PlayerStartComponent } from '../components/PlayerStartComponent.js';
import { GroupComponent } from '../components/GroupComponent.js';
import { ParentComponent } from '../components/ParentComponent.js';
import { CameraComponent } from '../components/CameraComponent.js';

const COMPONENT_REGISTRY = {
  TagComponent,
  TransformComponent,
  MeshComponent,
  LightComponent,
  TriggerComponent,
  PlayerStartComponent,
  GroupComponent,
  ParentComponent,
  CameraComponent,
};

function uuid() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export class Editor {
  renderer = null;
  threeScene = null;
  camera = null;
  orbitControls = null;
  transformControls = null;

  world = null;
  renderSystem = null;

  selectedEntityId = null;
  selectedEntityIds = new Set();
  transformMode = 'translate';
  project = null;

  #viewMode = 'default';
  #helpers = new Map();

  #listeners = new Map();
  container = null;
  #animFrameId = null;
  #clock = new THREE.Clock();
  #resizeObserver = null;

  constructor(project) {
    this.project = project;
  }

  get viewMode() { return this.#viewMode; }

  async init(container) {
    this.container = container;

    this.threeScene = new THREE.Scene();
    this.threeScene.background = new THREE.Color(0x1a1a1a);

    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(5, 5, 8);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGPURenderer({ antialias: true, preserveDrawingBuffer: true });
    await this.renderer.init();
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    const grid = new THREE.GridHelper(20, 20, 0x444444, 0x2a2a2a);
    this.threeScene.add(grid);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.threeScene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = false; // Editor-only light, doesn't cast shadows
    this.threeScene.add(dirLight);

    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.1;

    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.setMode(this.transformMode);
    this.threeScene.add(this.transformControls.getHelper());

    this.transformControls.addEventListener('dragging-changed', (e) => {
      this.orbitControls.enabled = !e.value;
    });

    this.transformControls.addEventListener('objectChange', () => {
      if (this.selectedEntityId === null) return;
      const obj = this.renderSystem.getObject3D(this.selectedEntityId);
      if (!obj) return;
      const tc = this.world.getComponent(this.selectedEntityId, TransformComponent);
      if (tc) {
        tc.position.copy(obj.position);
        tc.rotation.copy(obj.rotation);
        tc.scale.copy(obj.scale);
        this.emit('entity:changed', this.selectedEntityId);
      }
      // Update camera ref if it's a camera entity
      const camComp = this.world.getComponent(this.selectedEntityId, CameraComponent);
      if (camComp) this.#syncCameraRef(this.selectedEntityId, obj, camComp);
    });

    this.world = new World();
    this.renderSystem = new RenderSystem(this.threeScene);
    this.renderSystem.setParentComponentClass(ParentComponent);
    this.world.addSystem(this.renderSystem);

    this.#loadCurrentScene();

    this.renderer.domElement.addEventListener('pointerdown', this.#onPointerDown);

    this.#resizeObserver = new ResizeObserver(() => this.#onResize());
    this.#resizeObserver.observe(container);

    this.#animate();
  }

  #animate = () => {
    this.#animFrameId = requestAnimationFrame(this.#animate);
    const delta = this.#clock.getDelta();
    this.world.update(delta);
    this.orbitControls.update();
    this.#syncHelpers();
    this.renderer.render(this.threeScene, this.camera);
  };

  #onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  // --- View mode ---

  setViewMode(mode) {
    this.#viewMode = mode;
    // Restore all first
    for (const [, obj] of this.renderSystem.entityObjects) {
      obj.traverse(child => {
        if (!child.isMesh || child.userData.isEditorIcon) return;
        if (child.userData._origMat) {
          child.material = child.userData._origMat;
          delete child.userData._origMat;
        }
      });
    }
    if (mode !== 'default') {
      for (const [, obj] of this.renderSystem.entityObjects) {
        this.#applyViewModeToObject(obj, mode);
      }
    }
    this.emit('viewMode:changed', mode);
  }

  #applyViewModeToObject(obj, mode) {
    obj.traverse(child => {
      if (!child.isMesh || child.userData.isEditorIcon) return;
      if (!child.userData._origMat) child.userData._origMat = child.material;
      const color = child.userData._origMat.color;
      if (mode === 'wireframe') {
        child.material = new THREE.MeshBasicMaterial({ color, wireframe: true });
      } else {
        child.material = new THREE.MeshBasicMaterial({ color });
      }
    });
  }

  // --- Helpers (light/camera debug) ---

  #syncHelpers() {
    // Create or update helpers for light/camera entities
    for (const [entityId, obj] of this.renderSystem.entityObjects) {
      const lightComp = this.world.getComponent(entityId, LightComponent);
      const camComp = this.world.getComponent(entityId, CameraComponent);
      if (!lightComp && !camComp) continue;

      if (!this.#helpers.has(entityId)) {
        let helper = null;
        if (lightComp) {
          const lightRef = obj.userData.lightRef;
          if (lightRef) {
            if (lightComp.type === 'point') helper = new THREE.PointLightHelper(lightRef, 0.4);
            else if (lightComp.type === 'directional') helper = new THREE.DirectionalLightHelper(lightRef, 1);
            else if (lightComp.type === 'spot') helper = new THREE.SpotLightHelper(lightRef);
          }
        } else if (camComp) {
          const camRef = obj.userData.camRef;
          if (camRef) helper = new THREE.CameraHelper(camRef);
        }
        if (helper) {
          this.threeScene.add(helper);
          this.#helpers.set(entityId, helper);
        }
      } else {
        const helper = this.#helpers.get(entityId);
        helper.update?.();
      }
    }

    // Remove helpers for deleted entities
    for (const [entityId, helper] of this.#helpers) {
      if (!this.renderSystem.entityObjects.has(entityId)) {
        this.threeScene.remove(helper);
        helper.dispose?.();
        this.#helpers.delete(entityId);
      }
    }
  }

  #clearHelpers() {
    for (const helper of this.#helpers.values()) {
      this.threeScene.remove(helper);
      helper.dispose?.();
    }
    this.#helpers.clear();
  }

  #syncCameraRef(entityId, obj, camComp) {
    const camRef = obj.userData.camRef;
    if (camRef) {
      camRef.fov = camComp.fov;
      camRef.near = camComp.near;
      camRef.far = camComp.far;
      camRef.updateProjectionMatrix();
    }
  }

  // --- Selection ---

  #getHitEntityId(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);

    const selectables = [];
    for (const [, obj] of this.renderSystem.entityObjects) {
      obj.traverse(child => { if (child.isMesh || child.isSprite) selectables.push(child); });
    }

    const hits = raycaster.intersectObjects(selectables, false);
    if (hits.length === 0) return null;

    let hitObj = hits[0].object;
    while (hitObj && hitObj.userData.entityId === undefined) hitObj = hitObj.parent;
    return hitObj?.userData.entityId ?? null;
  }

  #onPointerDown = (e) => {
    if (e.button !== 0) return;
    if (this.transformControls.dragging) return;

    const entityId = this.#getHitEntityId(e);

    if (e.shiftKey) {
      if (entityId !== null) {
        if (this.selectedEntityIds.has(entityId)) {
          this.selectedEntityIds.delete(entityId);
          if (this.selectedEntityId === entityId) {
            this.selectedEntityId = [...this.selectedEntityIds].at(-1) ?? null;
          }
        } else {
          this.selectedEntityIds.add(entityId);
          this.selectedEntityId = entityId;
        }
      }
      if (this.selectedEntityId !== null) {
        const obj = this.renderSystem.getObject3D(this.selectedEntityId);
        if (obj) this.transformControls.attach(obj);
      } else {
        this.transformControls.detach();
      }
      this.emit('entity:selected', this.selectedEntityId);
      this.emit('selection:changed', this.selectedEntityIds, this.selectedEntityId);
    } else {
      this.selectEntity(entityId);
    }
  };

  selectEntity(entityId) {
    this.selectedEntityId = entityId;
    this.selectedEntityIds.clear();
    if (entityId !== null) this.selectedEntityIds.add(entityId);

    if (entityId === null) {
      this.transformControls.detach();
    } else {
      const obj = this.renderSystem.getObject3D(entityId);
      if (obj) this.transformControls.attach(obj);
    }

    this.emit('entity:selected', entityId);
    this.emit('selection:changed', this.selectedEntityIds, entityId);
  }

  clearSelection() {
    this.selectedEntityId = null;
    this.selectedEntityIds.clear();
    this.transformControls.detach();
    this.emit('entity:selected', null);
    this.emit('selection:changed', this.selectedEntityIds, null);
  }

  setTransformMode(mode) {
    this.transformMode = mode;
    this.transformControls.setMode(mode);
    this.emit('transformMode:changed', mode);
  }

  // --- Grouping ---

  groupSelectedEntities() {
    if (this.selectedEntityIds.size < 2) return;

    const ids = [...this.selectedEntityIds];
    const centroid = new THREE.Vector3();
    for (const id of ids) {
      const t = this.world.getComponent(id, TransformComponent);
      if (t) centroid.add(t.position);
    }
    centroid.divideScalar(ids.length);

    const groupId = this.world.createEntity();
    this.world.addComponent(groupId, new TagComponent('Group'));
    const groupTransform = new TransformComponent();
    groupTransform.position.copy(centroid);
    this.world.addComponent(groupId, groupTransform);
    this.world.addComponent(groupId, new GroupComponent());

    const groupObj = this.renderSystem.createObjectForEntity(groupId);

    for (const id of ids) {
      const t = this.world.getComponent(id, TransformComponent);
      if (t) t.position.sub(centroid);
      this.world.addComponent(id, new ParentComponent(groupId));

      const childObj = this.renderSystem.getObject3D(id);
      if (childObj && groupObj) {
        this.threeScene.remove(childObj);
        groupObj.add(childObj);
        if (t) childObj.position.copy(t.position);
      }
    }

    this.selectEntity(groupId);
    this.emit('hierarchy:changed');
  }

  ungroupEntity(groupEntityId) {
    const groupComp = this.world.getComponent(groupEntityId, GroupComponent);
    if (!groupComp) return;

    const groupTransform = this.world.getComponent(groupEntityId, TransformComponent);
    const groupPos = groupTransform?.position ?? new THREE.Vector3();

    const children = this.world.entities.filter(id => {
      const p = this.world.getComponent(id, ParentComponent);
      return p?.parentId === groupEntityId;
    });

    for (const id of children) {
      const t = this.world.getComponent(id, TransformComponent);
      if (t && groupTransform) t.position.add(groupPos);
      this.world.removeComponent(id, ParentComponent);

      const childObj = this.renderSystem.getObject3D(id);
      if (childObj) {
        childObj.removeFromParent();
        this.threeScene.add(childObj);
        if (t) childObj.position.copy(t.position);
      }
    }

    this.deleteEntity(groupEntityId);
    this.emit('hierarchy:changed');
  }

  // --- Prefab factories ---

  spawnEntity(name, setupFn) {
    const id = this.world.createEntity();
    this.world.addComponent(id, new TagComponent(name));
    this.world.addComponent(id, new TransformComponent());
    setupFn?.(id);
    this.renderSystem.createObjectForEntity(id);
    // Apply current view mode to new entity
    if (this.#viewMode !== 'default') {
      const obj = this.renderSystem.getObject3D(id);
      if (obj) this.#applyViewModeToObject(obj, this.#viewMode);
    }
    this.emit('hierarchy:changed');
    return id;
  }

  spawnCube() { return this.spawnEntity('Cube', id => this.world.addComponent(id, new MeshComponent('box', 0x4a9eff))); }
  spawnSphere() { return this.spawnEntity('Sphere', id => this.world.addComponent(id, new MeshComponent('sphere', 0xff6b4a))); }
  spawnCone() { return this.spawnEntity('Cone', id => this.world.addComponent(id, new MeshComponent('cone', 0x4aff6b))); }
  spawnCylinder() { return this.spawnEntity('Cylinder', id => this.world.addComponent(id, new MeshComponent('cylinder', 0xffcc4a))); }
  spawnCapsule() { return this.spawnEntity('Capsule', id => this.world.addComponent(id, new MeshComponent('capsule', 0xcc4aff))); }
  spawnPlane() { return this.spawnEntity('Plane', id => this.world.addComponent(id, new MeshComponent('plane', 0x888888))); }
  spawnPointLight() { return this.spawnEntity('PointLight', id => this.world.addComponent(id, new LightComponent('point', 0xffffff, 1))); }
  spawnDirectionalLight() { return this.spawnEntity('DirectionalLight', id => this.world.addComponent(id, new LightComponent('directional', 0xffffff, 1))); }
  spawnSpotLight() { return this.spawnEntity('SpotLight', id => this.world.addComponent(id, new LightComponent('spot', 0xffffff, 1))); }
  spawnSphereTrigger() { return this.spawnEntity('SphereTrigger', id => this.world.addComponent(id, new TriggerComponent('sphere', 1))); }
  spawnBoxTrigger() { return this.spawnEntity('BoxTrigger', id => this.world.addComponent(id, new TriggerComponent('box', 1))); }
  spawnPlayerStart() { return this.spawnEntity('PlayerStart', id => this.world.addComponent(id, new PlayerStartComponent())); }
  spawnCamera() { return this.spawnEntity('Camera', id => this.world.addComponent(id, new CameraComponent())); }

  deleteEntity(entityId) {
    if (this.selectedEntityId === entityId) this.selectEntity(null);
    this.selectedEntityIds.delete(entityId);

    // Clear helper for this entity
    const helper = this.#helpers.get(entityId);
    if (helper) {
      this.threeScene.remove(helper);
      helper.dispose?.();
      this.#helpers.delete(entityId);
    }

    const groupComp = this.world.getComponent(entityId, GroupComponent);
    if (groupComp) {
      const children = this.world.entities.filter(id => {
        const p = this.world.getComponent(id, ParentComponent);
        return p?.parentId === entityId;
      });
      for (const cid of children) {
        this.renderSystem.removeObjectForEntity(cid);
        this.world.destroyEntity(cid);
      }
    }

    this.renderSystem.removeObjectForEntity(entityId);
    this.world.destroyEntity(entityId);
    this.emit('hierarchy:changed');
  }

  renameEntity(entityId, name) {
    const tag = this.world.getComponent(entityId, TagComponent);
    if (tag) { tag.name = name; this.emit('hierarchy:changed'); }
  }

  rebuildEntityObject(entityId) {
    // Clear stale helper for this entity
    const oldHelper = this.#helpers.get(entityId);
    if (oldHelper) {
      this.threeScene.remove(oldHelper);
      oldHelper.dispose?.();
      this.#helpers.delete(entityId);
    }

    const parentComp = this.world.getComponent(entityId, ParentComponent);
    const obj = this.renderSystem.createObjectForEntity(entityId);

    if (parentComp) {
      const parentObj = this.renderSystem.getObject3D(parentComp.parentId);
      if (parentObj) {
        this.threeScene.remove(obj);
        parentObj.add(obj);
      }
    }

    // Re-apply view mode
    if (this.#viewMode !== 'default' && obj) this.#applyViewModeToObject(obj, this.#viewMode);

    if (this.selectedEntityId === entityId) {
      if (obj) this.transformControls.attach(obj);
    }
  }

  // --- Visual update helpers ---

  updateEntityColor(entityId, color) {
    const obj = this.renderSystem.getObject3D(entityId);
    if (!obj) return;
    obj.traverse(child => {
      if (child.isMesh && child.material && !child.userData.isEditorIcon) {
        const hex = parseInt(color.replace('#', ''), 16);
        if (child.userData._origMat) {
          child.userData._origMat.color.set(hex);
          if (this.#viewMode !== 'default') {
            child.material.color.set(hex);
          }
        } else {
          child.material.color.set(hex);
        }
        const meshComp = this.world.getComponent(entityId, MeshComponent);
        if (meshComp) meshComp.color = hex;
      }
    });
  }

  updateEntityLight(entityId) {
    const lightComp = this.world.getComponent(entityId, LightComponent);
    const obj = this.renderSystem.getObject3D(entityId);
    if (!obj || !lightComp) return;
    const lightRef = obj.userData.lightRef;
    if (lightRef) {
      lightRef.color.set(lightComp.color);
      lightRef.intensity = lightComp.intensity;
    } else {
      this.rebuildEntityObject(entityId);
    }
  }

  updateEntityCamera(entityId) {
    const camComp = this.world.getComponent(entityId, CameraComponent);
    const obj = this.renderSystem.getObject3D(entityId);
    if (!obj || !camComp) return;
    this.#syncCameraRef(entityId, obj, camComp);
  }

  // --- Scene management ---

  #loadCurrentScene() {
    this.#clearHelpers();
    const scene = this.#currentScene();
    if (scene?.worldData) {
      this.world.restore(scene.worldData, COMPONENT_REGISTRY);
      this.renderSystem.rebuildAll();
    } else {
      this.world.clear();
      this.renderSystem.rebuildAll();
    }
    // Re-apply view mode after rebuild
    if (this.#viewMode !== 'default') {
      for (const [, obj] of this.renderSystem.entityObjects) {
        this.#applyViewModeToObject(obj, this.#viewMode);
      }
    }
    this.selectEntity(null);
    this.emit('hierarchy:changed');
  }

  saveCurrentScene() {
    const scene = this.#currentScene();
    if (scene) {
      scene.worldData = this.world.snapshot();
      // Capture thumbnail
      try {
        scene.thumbnail = this.renderer.domElement.toDataURL('image/jpeg', 0.4);
      } catch (e) { /* WebGPU may not support toDataURL in all browsers */ }
      this.emit('scene:saved');
    }
  }

  saveProject() {
    this.saveCurrentScene();
    this.emit('project:saved');
    return this.project;
  }

  switchScene(sceneIndex) {
    this.saveCurrentScene();
    this.project.currentSceneIndex = sceneIndex;
    this.#loadCurrentScene();
    this.emit('scene:switched', sceneIndex);
    this.emit('scenes:changed');
  }

  addScene(name, copyCurrentScene = false) {
    const newScene = {
      id: uuid(),
      name,
      worldData: copyCurrentScene ? this.world.snapshot() : null,
    };
    this.project.scenes.push(newScene);
    this.emit('scenes:changed');
    return this.project.scenes.length - 1;
  }

  deleteScene(sceneIndex) {
    if (this.project.scenes.length <= 1) return;
    this.project.scenes.splice(sceneIndex, 1);
    if (this.project.currentSceneIndex >= this.project.scenes.length) {
      this.project.currentSceneIndex = this.project.scenes.length - 1;
    }
    this.#loadCurrentScene();
    this.emit('scenes:changed');
  }

  renameScene(sceneIndex, name) {
    const s = this.project.scenes[sceneIndex];
    if (s) { s.name = name; this.emit('scenes:changed'); }
  }

  #currentScene() {
    return this.project.scenes[this.project.currentSceneIndex] ?? null;
  }

  get currentSceneIndex() { return this.project.currentSceneIndex; }

  // --- Events ---

  on(event, fn) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) { this.#listeners.get(event)?.delete(fn); }

  emit(event, ...args) {
    this.#listeners.get(event)?.forEach(fn => fn(...args));
  }

  // --- Cleanup ---

  destroy() {
    cancelAnimationFrame(this.#animFrameId);
    this.#resizeObserver?.disconnect();
    this.#clearHelpers();
    this.renderer.domElement.removeEventListener('pointerdown', this.#onPointerDown);
    this.orbitControls.dispose();
    this.transformControls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.#listeners.clear();
  }
}
