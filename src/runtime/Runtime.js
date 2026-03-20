import * as THREE from 'three/webgpu';
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
import { FogComponent } from '../components/FogComponent.js';

const COMPONENT_REGISTRY = {
  TagComponent, TransformComponent, MeshComponent, LightComponent,
  TriggerComponent, PlayerStartComponent, GroupComponent, ParentComponent,
  CameraComponent, FogComponent,
};

export class Runtime {
  #overlay = null;
  #renderer = null;
  #scene = null;
  #camera = null;
  #world = null;
  #renderSystem = null;
  #animFrameId = null;
  #clock = null;
  #resizeObserver = null;
  #onExit = null;

  // FPS controls
  #keys = {};
  #pitch = 0;
  #yaw = 0;
  #onKeyDown = null;
  #onKeyUp = null;
  #onMouseMove = null;

  constructor(onExit) {
    this.#onExit = onExit;
  }

  async start(sceneData) {
    this.#overlay = document.createElement('div');
    this.#overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 5000;
      background: #000; display: flex; flex-direction: column;
    `;
    document.body.appendChild(this.#overlay);

    // HUD bar
    const hud = document.createElement('div');
    hud.style.cssText = `
      position: absolute; top: 0; left: 0; right: 0; height: 36px;
      background: rgba(0,0,0,0.75); display: flex; align-items: center;
      padding: 0 16px; gap: 12px; z-index: 1; font-family: system-ui; font-size: 13px; color: #ccc;
    `;
    hud.style.position = 'relative';
    hud.innerHTML = `
      <span style="color:#3fd46b;font-weight:700;">&#9654; Runtime</span>
      <span>${sceneData?.name ?? 'Scene'}</span>
      <span style="flex:1"></span>
      <span style="color:#888;font-size:11px;">Click: mouse look &nbsp;|&nbsp; WASD: move &nbsp;|&nbsp; Q/E: up/down &nbsp;|&nbsp; Esc: exit</span>
      <button id="runtime-exit" style="
        position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        padding:4px 16px;background:#d43f3f;border:none;border-radius:3px;
        color:white;cursor:pointer;font-size:12px;font-weight:600;
      ">&#9632; Exit</button>
      <label id="runtime-debug-wrap" style="display:flex;align-items:center;gap:5px;cursor:pointer;margin-left:8px;user-select:none;">
        <input type="checkbox" id="runtime-debug" style="cursor:pointer;accent-color:#3fd46b;" />
        <span style="font-size:11px;color:#888;">Debug</span>
      </label>
    `;
    this.#overlay.appendChild(hud);
    hud.querySelector('#runtime-exit').addEventListener('click', () => this.stop());
    hud.querySelector('#runtime-debug').addEventListener('change', (e) => {
      this.#renderSystem.setEditorVisualsVisible(e.target.checked);
    });

    // Viewport
    const viewport = document.createElement('div');
    viewport.style.cssText = 'flex:1;position:relative;overflow:hidden;cursor:crosshair;';
    this.#overlay.appendChild(viewport);

    // Three.js setup
    this.#scene = new THREE.Scene();
    this.#scene.background = new THREE.Color(0x111111);
    this.#camera = new THREE.PerspectiveCamera(60, viewport.clientWidth / viewport.clientHeight, 0.1, 1000);
    this.#camera.position.set(5, 5, 8);
    this.#camera.lookAt(0, 0, 0);

    this.#renderer = new THREE.WebGPURenderer({ antialias: true });
    await this.#renderer.init();
    this.#renderer.setPixelRatio(window.devicePixelRatio);
    this.#renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    this.#renderer.shadowMap.enabled = true;
    this.#renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    viewport.appendChild(this.#renderer.domElement);

    // ECS
    this.#world = new World();
    this.#renderSystem = new RenderSystem(this.#scene);
    this.#renderSystem.setParentComponentClass(ParentComponent);
    this.#world.addSystem(this.#renderSystem);

    if (sceneData?.worldData) {
      this.#world.restore(sceneData.worldData, COMPONENT_REGISTRY);
      this.#renderSystem.rebuildAll();
      // Hide editor-only icons (camera/light sprites, range spheres) during gameplay
      this.#renderSystem.hideEditorIcons();
    }

    // Apply scene background color if defined
    if (sceneData?.background) {
      this.#scene.background = new THREE.Color(sceneData.background);
    }

    // Apply camera entity if present
    this.#applySceneCamera();

    // Extract initial yaw/pitch from camera quaternion
    const euler = new THREE.Euler();
    euler.setFromQuaternion(this.#camera.quaternion, 'YXZ');
    this.#pitch = euler.x;
    this.#yaw = euler.y;

    // FPS controls
    this.#onKeyDown = (e) => {
      this.#keys[e.code] = true;
      if (e.key === 'Escape') this.stop();
    };
    this.#onKeyUp = (e) => { this.#keys[e.code] = false; };
    this.#onMouseMove = (e) => {
      if (document.pointerLockElement !== viewport) return;
      this.#yaw -= e.movementX * 0.002;
      this.#pitch -= e.movementY * 0.002;
      this.#pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.#pitch));
      this.#camera.quaternion.setFromEuler(new THREE.Euler(this.#pitch, this.#yaw, 0, 'YXZ'));
    };

    viewport.addEventListener('click', () => viewport.requestPointerLock());
    document.addEventListener('keydown', this.#onKeyDown);
    document.addEventListener('keyup', this.#onKeyUp);
    document.addEventListener('mousemove', this.#onMouseMove);

    // Resize
    this.#resizeObserver = new ResizeObserver(() => {
      const w = viewport.clientWidth;
      const h = viewport.clientHeight;
      this.#camera.aspect = w / h;
      this.#camera.updateProjectionMatrix();
      this.#renderer.setSize(w, h);
    });
    this.#resizeObserver.observe(viewport);

    this.#clock = new THREE.Clock();
    this.#animate();
  }

  #applySceneCamera() {
    const camEntities = this.#world.entities.filter(id => this.#world.getComponent(id, CameraComponent));
    if (camEntities.length === 0) return;
    const camId = camEntities[0];
    const camComp = this.#world.getComponent(camId, CameraComponent);
    const transform = this.#world.getComponent(camId, TransformComponent);
    if (camComp) {
      this.#camera.fov = camComp.fov;
      this.#camera.near = camComp.near;
      this.#camera.far = camComp.far;
      this.#camera.updateProjectionMatrix();
    }
    if (transform) {
      this.#camera.position.copy(transform.position);
      this.#camera.rotation.copy(transform.rotation);
    }
  }

  #animate = () => {
    this.#animFrameId = requestAnimationFrame(this.#animate);
    const delta = this.#clock.getDelta();

    // FPS movement
    const speed = 5 * delta;
    const anyMove = this.#keys['KeyW'] || this.#keys['KeyS'] || this.#keys['KeyA'] ||
                    this.#keys['KeyD'] || this.#keys['KeyE'] || this.#keys['KeyQ'];
    if (anyMove) {
      const forward = new THREE.Vector3(
        -Math.sin(this.#yaw) * Math.cos(this.#pitch),
        Math.sin(this.#pitch),
        -Math.cos(this.#yaw) * Math.cos(this.#pitch)
      );
      const right = new THREE.Vector3(Math.cos(this.#yaw), 0, -Math.sin(this.#yaw));
      const up = new THREE.Vector3(0, 1, 0);

      if (this.#keys['KeyW']) this.#camera.position.addScaledVector(forward, speed);
      if (this.#keys['KeyS']) this.#camera.position.addScaledVector(forward, -speed);
      if (this.#keys['KeyA']) this.#camera.position.addScaledVector(right, -speed);
      if (this.#keys['KeyD']) this.#camera.position.addScaledVector(right, speed);
      if (this.#keys['KeyE']) this.#camera.position.addScaledVector(up, speed);
      if (this.#keys['KeyQ']) this.#camera.position.addScaledVector(up, -speed);
    }

    this.#world.update(delta);
    this.#renderer.render(this.#scene, this.#camera);
  };

  stop() {
    cancelAnimationFrame(this.#animFrameId);
    this.#resizeObserver?.disconnect();
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.#onKeyDown) document.removeEventListener('keydown', this.#onKeyDown);
    if (this.#onKeyUp) document.removeEventListener('keyup', this.#onKeyUp);
    if (this.#onMouseMove) document.removeEventListener('mousemove', this.#onMouseMove);
    this.#renderer?.dispose();
    this.#overlay?.remove();
    this.#onExit?.();
  }
}
