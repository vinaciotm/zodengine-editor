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

const COMPONENT_REGISTRY = {
  TagComponent,
  TransformComponent,
  MeshComponent,
  LightComponent,
  TriggerComponent,
  PlayerStartComponent,
};

function uuid() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export class Editor {
  // Three.js
  renderer = null;
  threeScene = null;
  camera = null;
  orbitControls = null;
  transformControls = null;

  // ECS
  world = null;
  renderSystem = null;

  // State
  selectedEntityId = null;
  transformMode = 'translate'; // translate | rotate | scale
  project = null;

  // Event listeners map
  #listeners = new Map();

  // Viewport container
  container = null;

  // Animation
  #animFrameId = null;
  #clock = new THREE.Clock();

  // ResizeObserver
  #resizeObserver = null;

  constructor(project) {
    this.project = project;
  }

  async init(container) {
    this.container = container;

    // Three.js setup
    this.threeScene = new THREE.Scene();
    this.threeScene.background = new THREE.Color(0x1a1a1a);

    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(5, 5, 8);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGPURenderer({ antialias: true });
    await this.renderer.init();
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    // Editor helpers
    const grid = new THREE.GridHelper(20, 20, 0x444444, 0x2a2a2a);
    this.threeScene.add(grid);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.threeScene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    this.threeScene.add(dirLight);

    // Orbit controls
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.1;

    // Transform controls (gizmo)
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
    });

    // ECS
    this.world = new World();
    this.renderSystem = new RenderSystem(this.threeScene);
    this.world.addSystem(this.renderSystem);

    // Load current scene
    this.#loadCurrentScene();

    // Click selection
    this.renderer.domElement.addEventListener('pointerdown', this.#onPointerDown);

    // ResizeObserver
    this.#resizeObserver = new ResizeObserver(() => this.#onResize());
    this.#resizeObserver.observe(container);

    // Start loop
    this.#animate();
  }

  #animate = () => {
    this.#animFrameId = requestAnimationFrame(this.#animate);
    const delta = this.#clock.getDelta();
    this.world.update(delta);
    this.orbitControls.update();
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

  #onPointerDown = (e) => {
    if (e.button !== 0) return;
    // Don't select if transform controls is being dragged
    if (this.transformControls.dragging) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);

    // Collect all selectable objects
    const selectables = [];
    for (const [, obj] of this.renderSystem.entityObjects) {
      obj.traverse(child => { if (child.isMesh) selectables.push(child); });
    }

    const hits = raycaster.intersectObjects(selectables, false);
    if (hits.length === 0) {
      this.selectEntity(null);
      return;
    }

    // Walk up to find the entity root object
    let hitObj = hits[0].object;
    while (hitObj && hitObj.userData.entityId === undefined) hitObj = hitObj.parent;
    if (hitObj?.userData.entityId !== undefined) {
      this.selectEntity(hitObj.userData.entityId);
    }
  };

  selectEntity(entityId) {
    this.selectedEntityId = entityId;

    if (entityId === null) {
      this.transformControls.detach();
    } else {
      const obj = this.renderSystem.getObject3D(entityId);
      if (obj) this.transformControls.attach(obj);
    }

    this.emit('entity:selected', entityId);
  }

  setTransformMode(mode) {
    this.transformMode = mode;
    this.transformControls.setMode(mode);
    this.emit('transformMode:changed', mode);
  }

  // --- Prefab factories ---

  spawnEntity(name, setupFn) {
    const id = this.world.createEntity();
    this.world.addComponent(id, new TagComponent(name));
    this.world.addComponent(id, new TransformComponent());
    setupFn?.(id);
    this.renderSystem.createObjectForEntity(id);
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

  deleteEntity(entityId) {
    if (this.selectedEntityId === entityId) this.selectEntity(null);
    this.renderSystem.removeObjectForEntity(entityId);
    this.world.destroyEntity(entityId);
    this.emit('hierarchy:changed');
  }

  renameEntity(entityId, name) {
    const tag = this.world.getComponent(entityId, TagComponent);
    if (tag) { tag.name = name; this.emit('hierarchy:changed'); }
  }

  rebuildEntityObject(entityId) {
    this.renderSystem.createObjectForEntity(entityId);
    if (this.selectedEntityId === entityId) {
      const obj = this.renderSystem.getObject3D(entityId);
      if (obj) this.transformControls.attach(obj);
    }
  }

  // --- Visual update helpers (called by Inspector) ---

  updateEntityColor(entityId, color) {
    const obj = this.renderSystem.getObject3D(entityId);
    if (!obj) return;
    obj.traverse(child => {
      if (child.isMesh && child.material) {
        const hex = parseInt(color.replace('#', ''), 16);
        child.material.color.set(hex);
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
      // rebuild
      this.rebuildEntityObject(entityId);
    }
  }

  // --- Scene management ---

  #loadCurrentScene() {
    const scene = this.#currentScene();
    if (scene?.worldData) {
      this.world.restore(scene.worldData, COMPONENT_REGISTRY);
      this.renderSystem.rebuildAll();
    }
    this.selectEntity(null);
    this.emit('hierarchy:changed');
  }

  saveCurrentScene() {
    const scene = this.#currentScene();
    if (scene) {
      scene.worldData = this.world.snapshot();
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
  }

  addScene(name) {
    const id = uuid();
    this.project.scenes.push({ id, name, worldData: null });
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
