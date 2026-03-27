import * as THREE from "three/webgpu";
import { sfx } from '../gui/sfx.js';
import {
  CommandManager,
  SpawnCommand,
  DeleteCommand,
  RenameCommand,
  TransformCommand,
} from "./CommandManager.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { World } from "../ecs/World.js";
import { RenderSystem } from "../systems/RenderSystem.js";
import { TagComponent } from "../components/TagComponent.js";
import { TransformComponent } from "../components/TransformComponent.js";
import { MeshComponent } from "../components/MeshComponent.js";
import { LightComponent } from "../components/LightComponent.js";
import { TriggerComponent } from "../components/TriggerComponent.js";
import { PlayerStartComponent } from "../components/PlayerStartComponent.js";
import { GroupComponent } from "../components/GroupComponent.js";
import { ParentComponent } from "../components/ParentComponent.js";
import { CameraComponent } from "../components/CameraComponent.js";
import { FogComponent } from "../components/FogComponent.js";
import { SkyBoxComponent } from "../components/SkyBoxComponent.js";

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
  FogComponent,
  SkyBoxComponent,
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
  transformMode = "translate";
  project = null;
  isPlaying = false;
  commandManager = new CommandManager();
  sceneCommandManager = new CommandManager();

  #viewMode = "default";
  #helpers = new Map();
  #transformBefore = null;
  #clipboard = null;
  #pointerDownPos = null;
  #pointerDragged = false;
  #grid = null;
  #rightMouseDown = false;
  #keysHeld = new Set();
  #flySpeed = 8;

  #listeners = new Map();
  container = null;
  #animFrameId = null;
  #rotateCursorUrl = (() => {
    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
      `<path d="M12 3a9 9 0 1 1-8.5 6" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"/>` +
      `<polygon points="3,3 4,9 9,7" fill="white"/>` +
      `</svg>`
    );
    return `url("data:image/svg+xml,${svg}") 12 12, alias`;
  })();
  #clock = new THREE.Timer();
  #resizeObserver = null;
  #cameraPreviewOverlay = null;

  constructor(project) {
    this.project = project;
  }

  get viewMode() {
    return this.#viewMode;
  }

  get isCameraFlying() {
    return this.#rightMouseDown;
  }

  async init(container) {
    this.container = container;

    this.threeScene = new THREE.Scene();
    this.threeScene.background = new THREE.Color(0x1a1a1a);

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    this.camera.position.set(5, 5, 8);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGPURenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    await this.renderer.init();
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    this.#grid = new THREE.GridHelper(80, 80, 0x444444, 0x2a2a2a);
    this.threeScene.add(this.#grid);

    this.orbitControls = new OrbitControls(
      this.camera,
      this.renderer.domElement,
    );
    this.orbitControls.enableDamping = false;
    this.orbitControls.addEventListener('end', () => {
      const scene = this.#currentScene();
      if (scene) {
        scene.editorCamera = {
          position: this.camera.position.toArray(),
          target: this.orbitControls.target.toArray(),
        };
      }
    });

    this.transformControls = new TransformControls(
      this.camera,
      this.renderer.domElement,
    );
    this.transformControls.setMode(this.transformMode);
    this.threeScene.add(this.transformControls.getHelper());

    this.transformControls.addEventListener("dragging-changed", (e) => {
      this.orbitControls.enabled = !e.value;
      if (e.value) {
        this.#transformBefore = this.#captureTransform(this.selectedEntityId);
      } else {
        if (this.#transformBefore !== null && this.selectedEntityId !== null) {
          const after = this.#captureTransform(this.selectedEntityId);
          this.commandManager.push(
            new TransformCommand(
              this,
              this.selectedEntityId,
              this.#transformBefore,
              after,
            ),
          );
          this.#transformBefore = null;
        }
      }
    });

    this.transformControls.addEventListener("objectChange", () => {
      if (this.selectedEntityId === null) return;
      const obj = this.renderSystem.getObject3D(this.selectedEntityId);
      if (!obj) return;
      const tc = this.world.getComponent(
        this.selectedEntityId,
        TransformComponent,
      );
      if (tc) {
        tc.position.copy(obj.position);
        tc.rotation.copy(obj.rotation);
        tc.scale.copy(obj.scale);
        this.emit("entity:changed", this.selectedEntityId);
      }
      const camComp = this.world.getComponent(
        this.selectedEntityId,
        CameraComponent,
      );
      if (camComp) this.#syncCameraRef(this.selectedEntityId, obj, camComp);
    });

    this.world = new World();
    this.renderSystem = new RenderSystem(this.threeScene);
    this.renderSystem.renderer = this.renderer;
    this.renderSystem.shadowsEnabled = true;
    this.renderSystem.setParentComponentClass(ParentComponent);
    this.world.addSystem(this.renderSystem);

    this.#loadCurrentScene();

    this.renderer.domElement.addEventListener("pointerdown",  this.#onPointerDown);
    this.renderer.domElement.addEventListener("pointermove",  this.#onPointerMove);
    this.renderer.domElement.addEventListener("pointerup",    this.#onPointerUp);
    this.renderer.domElement.addEventListener("pointermove",  this.#onGizmoCursor);
    this.renderer.domElement.addEventListener("mousedown",    this.#onRightMouseDown);
    this.renderer.domElement.addEventListener("mouseup",      this.#onRightMouseUp);
    this.renderer.domElement.addEventListener("contextmenu",  (e) => e.preventDefault());
    window.addEventListener("keydown", this.#onFlyKeyDown);
    window.addEventListener("keyup",   this.#onFlyKeyUp);

    this.#resizeObserver = new ResizeObserver(() => this.#onResize());
    this.#resizeObserver.observe(container);

    // Camera preview overlay (border + label, drawn on top of canvas)
    this.#cameraPreviewOverlay = document.createElement("div");
    this.#cameraPreviewOverlay.style.cssText = [
      "position:absolute",
      "bottom:8px",
      "right:8px",
      "width:240px",
      "height:135px",
      "border:2px solid rgba(100,160,255,0.75)",
      "border-radius:4px",
      "pointer-events:none",
      "display:none",
      "z-index:10",
      "box-sizing:border-box",
    ].join(";");
    const previewLabel = document.createElement("div");
    previewLabel.style.cssText = [
      "position:absolute",
      "top:4px",
      "left:6px",
      "color:rgba(100,180,255,0.9)",
      "font-family:system-ui",
      "font-size:10px",
      "letter-spacing:0.3px",
      "pointer-events:none",
    ].join(";");
    previewLabel.textContent = "Camera Preview";
    this.#cameraPreviewOverlay.appendChild(previewLabel);
    container.appendChild(this.#cameraPreviewOverlay);

    this.#animate();
  }

  #animate = () => {
    this.#animFrameId = requestAnimationFrame(this.#animate);
    this.#clock.update();
    const delta = this.#clock.getDelta();
    this.#applyFlyMovement(delta);
    this.world.update(delta);
    this.orbitControls.update();
    this.#syncHelpers();
    this.renderer.render(this.threeScene, this.camera);
    this.#updateCameraPreview();
  };

  #updateCameraPreview() {
    const overlay = this.#cameraPreviewOverlay;
    if (!overlay) return;

    const selId = this.selectedEntityId;
    let camRef = null;
    if (selId !== null) {
      const obj = this.renderSystem.getObject3D(selId);
      camRef = obj?.userData.camRef ?? null;
    }

    if (!camRef) {
      overlay.style.display = "none";
      return;
    }

    overlay.style.display = "block";

    const cw = this.container.clientWidth;
    const ch = this.container.clientHeight;
    const pw = 240,
      ph = 135;
    const px = cw - pw - 8;
    const py = ch - ph - 8;

    camRef.aspect = pw / ph;
    camRef.updateProjectionMatrix();

    // Temporarily hide all editor-only indicators (sprites, rings, line groups, editor-only entities)
    const hiddenIcons = [];
    this.threeScene.traverse((child) => {
      if ((child.userData.isEditorIcon || child.userData.isEditorOnly) && child.visible) {
        hiddenIcons.push(child);
        child.visible = false;
      }
    });
    const tcHelper = this.transformControls.getHelper();
    tcHelper.visible = false;
    for (const helper of this.#helpers.values()) helper.visible = false;

    const prevAutoClear = this.renderer.autoClear;
    this.renderer.autoClear = false;
    this.renderer.setScissorTest(true);
    this.renderer.setScissor(px, py, pw, ph);
    this.renderer.setViewport(px, py, pw, ph);
    this.renderer.clear(true, true, false);
    this.renderer.render(this.threeScene, camRef);
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, cw, ch);
    this.renderer.autoClear = prevAutoClear;

    // Restore visibility
    for (const icon of hiddenIcons) icon.visible = true;
    tcHelper.visible = true;
    for (const helper of this.#helpers.values()) helper.visible = true;
  }

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
    for (const [, obj] of this.renderSystem.entityObjects) {
      obj.traverse((child) => {
        if (!child.isMesh || child.userData.isEditorIcon) return;
        if (child.userData._origMat) {
          child.material = child.userData._origMat;
          delete child.userData._origMat;
        }
      });
    }
    if (mode !== "default") {
      for (const [, obj] of this.renderSystem.entityObjects) {
        this.#applyViewModeToObject(obj, mode);
      }
      this.renderSystem.setLightingEnabled(false);
    } else {
      this.renderSystem.setLightingEnabled(true);
    }
    this.emit("viewMode:changed", mode);
  }

  #applyViewModeToObject(obj, mode) {
    obj.traverse((child) => {
      if (!child.isMesh || child.userData.isEditorIcon) return;
      if (!child.userData._origMat) child.userData._origMat = child.material;
      const color = child.userData._origMat.color;
      if (mode === "wireframe") {
        child.material = new THREE.MeshBasicMaterial({
          color,
          wireframe: true,
        });
      } else {
        child.material = new THREE.MeshBasicMaterial({ color });
      }
    });
  }

  // --- Helpers (light/camera debug) ---

  #syncHelpers() {
    // Light debug is embedded inside entity groups (RenderSystem) — only cameras need a scene helper
    for (const [entityId, obj] of this.renderSystem.entityObjects) {
      const camComp = this.world.getComponent(entityId, CameraComponent);
      if (!camComp) continue;

      if (!this.#helpers.has(entityId)) {
        const camRef = obj.userData.camRef;
        if (camRef) {
          const helper = new THREE.CameraHelper(camRef);
          // Paint all lines white
          const colors = helper.geometry.attributes.color;
          if (colors) {
            for (let i = 0; i < colors.count; i++) colors.setXYZ(i, 1, 1, 1);
            colors.needsUpdate = true;
          }
          helper.material.transparent = true;
          helper.material.opacity = 0.15;
          this.threeScene.add(helper);
          this.#helpers.set(entityId, helper);
        }
      } else {
        this.#helpers.get(entityId).update?.();
      }
    }

    for (const [entityId, helper] of this.#helpers) {
      if (!this.renderSystem.entityObjects.has(entityId)) {
        this.threeScene.remove(helper);
        helper.dispose?.();
        this.#helpers.delete(entityId);
      }
    }
  }

  #updateDebugOpacities() {
    for (const [entityId, obj] of this.renderSystem.entityObjects) {
      const isSelected = this.selectedEntityIds.has(entityId);
      const opacity = isSelected ? 0.35 : 0.15;
      for (const child of obj.children) {
        if (!child.userData.isEditorIcon) continue;
        child.traverse((node) => {
          // Skip sprites — keep their original material opacity
          if (node.material && !node.isSprite) node.material.opacity = opacity;
        });
      }
    }
    // Camera helpers live outside entity objects — update their opacity too
    for (const [entityId, helper] of this.#helpers) {
      const isSelected = this.selectedEntityIds.has(entityId);
      helper.material.opacity = isSelected ? 0.35 : 0.15;
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
      obj.traverse((child) => {
        if (child.isMesh || child.isSprite) selectables.push(child);
      });
    }

    const hits = raycaster.intersectObjects(selectables, false);
    if (hits.length === 0) return null;

    let hitObj = hits[0].object;
    while (hitObj && hitObj.userData.entityId === undefined)
      hitObj = hitObj.parent;
    return hitObj?.userData.entityId ?? null;
  }

  #onGizmoCursor = () => {
    const axis = this.transformControls?.axis;
    const el = this.renderer?.domElement;
    if (!el) return;
    if (!axis) { el.style.cursor = ''; return; }
    switch (this.transformMode) {
      case 'translate': el.style.cursor = 'move'; break;
      case 'rotate':    el.style.cursor = this.#rotateCursorUrl; break;
      case 'scale':     el.style.cursor = 'nwse-resize'; break;
      default:          el.style.cursor = '';
    }
  };

  #onRightMouseDown = (e) => {
    if (e.button !== 2) return;
    this.#rightMouseDown = true;
    this.orbitControls.enabled = false;
    this.renderer.domElement.style.cursor = 'crosshair';
  };

  #onRightMouseUp = (e) => {
    if (e.button !== 2) return;
    this.#rightMouseDown = false;
    this.orbitControls.enabled = true;
    this.renderer.domElement.style.cursor = '';
  };

  #onFlyKeyDown = (e) => {
    if (this.#rightMouseDown) this.#keysHeld.add(e.code);
  };

  #onFlyKeyUp = (e) => {
    this.#keysHeld.delete(e.code);
  };

  #applyFlyMovement(delta) {
    if (!this.#rightMouseDown || this.#keysHeld.size === 0) return;
    const speed = this.#flySpeed * delta;
    const cam = this.camera;
    const forward = new THREE.Vector3();
    cam.getWorldDirection(forward);
    forward.y = 0; forward.normalize();
    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const move = new THREE.Vector3();
    if (this.#keysHeld.has('KeyW') || this.#keysHeld.has('ArrowUp'))    move.addScaledVector(forward,  1);
    if (this.#keysHeld.has('KeyS') || this.#keysHeld.has('ArrowDown'))  move.addScaledVector(forward, -1);
    if (this.#keysHeld.has('KeyA') || this.#keysHeld.has('ArrowLeft'))  move.addScaledVector(right,   -1);
    if (this.#keysHeld.has('KeyD') || this.#keysHeld.has('ArrowRight')) move.addScaledVector(right,    1);
    if (this.#keysHeld.has('KeyQ')) move.y -= 1;
    if (this.#keysHeld.has('KeyE')) move.y += 1;
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed);
      cam.position.add(move);
      this.orbitControls.target.add(move);
    }
  }

  #onPointerDown = (e) => {
    if (e.button !== 0) return;
    this.#pointerDownPos = { x: e.clientX, y: e.clientY };
    this.#pointerDragged = false;
  };

  #onPointerMove = (e) => {
    if (!this.#pointerDownPos) return;
    const dx = e.clientX - this.#pointerDownPos.x;
    const dy = e.clientY - this.#pointerDownPos.y;
    if (dx * dx + dy * dy > 25) this.#pointerDragged = true; // 5px threshold
  };

  #onPointerUp = (e) => {
    if (e.button !== 0) return;
    if (!this.#pointerDownPos) return;
    this.#pointerDownPos = null;
    if (this.#pointerDragged) return;       // orbit drag — don't change selection
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
      this.emit("entity:selected", this.selectedEntityId);
      this.emit("selection:changed", this.selectedEntityIds, this.selectedEntityId);
    } else {
      this.selectEntity(entityId);
    }
  };

  selectEntity(entityId) {
    this.selectedEntityId = entityId;
    this.selectedEntityIds.clear();
    if (entityId !== null) this.selectedEntityIds.add(entityId);

    if (entityId === null || this.transformMode === 'select') {
      this.transformControls.detach();
    } else {
      const obj = this.renderSystem.getObject3D(entityId);
      if (obj) this.transformControls.attach(obj);
    }

    this.emit("entity:selected", entityId);
    this.emit("selection:changed", this.selectedEntityIds, entityId);
    this.#updateDebugOpacities();
  }

  clearSelection() {
    this.selectedEntityId = null;
    this.selectedEntityIds.clear();
    this.transformControls.detach();
    this.emit("entity:selected", null);
    this.emit("selection:changed", this.selectedEntityIds, null);
    this.#updateDebugOpacities();
  }

  setTransformMode(mode) {
    this.transformMode = mode;
    if (mode === 'select') {
      this.transformControls.detach();
    } else {
      this.transformControls.setMode(mode);
      if (this.selectedEntityId !== null) {
        const obj = this.renderSystem.getObject3D(this.selectedEntityId);
        if (obj) this.transformControls.attach(obj);
      }
    }
    this.emit("transformMode:changed", mode);
  }

  setSnap(enabled, step) {
    if (enabled) {
      this.transformControls.translationSnap = step;
      this.transformControls.rotationSnap = Math.PI / 180; // always 1°
      this.transformControls.scaleSnap = step;
    } else {
      this.transformControls.translationSnap = null;
      this.transformControls.rotationSnap = null;
      this.transformControls.scaleSnap = null;
    }
    this.emit("snap:changed", { enabled, step });
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
    this.world.addComponent(groupId, new TagComponent("Group"));
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
    this.emit("hierarchy:changed");
  }

  // cmd+shift+g: if entity is a group → ungroup all; if entity is inside a group → remove it
  ungroupOrRemoveFromGroup(entityId) {
    const isGroup = this.world.hasComponent(entityId, GroupComponent);
    if (isGroup) {
      this.ungroupEntity(entityId);
      return;
    }
    const parentComp = this.world.getComponent(entityId, ParentComponent);
    if (parentComp) {
      const groupId = parentComp.parentId;
      const t = this.world.getComponent(entityId, TransformComponent);
      const groupTransform = this.world.getComponent(groupId, TransformComponent);
      if (t && groupTransform) t.position.add(groupTransform.position);
      this.world.removeComponent(entityId, ParentComponent);
      const childObj = this.renderSystem.getObject3D(entityId);
      if (childObj) {
        childObj.removeFromParent();
        this.threeScene.add(childObj);
        if (t) childObj.position.copy(t.position);
      }
      this.emit('hierarchy:changed');
    }
  }

  ungroupEntity(groupEntityId) {
    const groupComp = this.world.getComponent(groupEntityId, GroupComponent);
    if (!groupComp) return;

    const groupTransform = this.world.getComponent(
      groupEntityId,
      TransformComponent,
    );
    const groupPos = groupTransform?.position ?? new THREE.Vector3();

    const children = this.world.entities.filter((id) => {
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
    this.emit("hierarchy:changed");
  }

  // --- Prefab factories ---

  spawnEntity(name, setupFn) {
    const id = this.#spawnEntityRaw(name, setupFn);
    this.commandManager.push(new SpawnCommand(this, id));
    sfx.spawn();
    this.emit("hierarchy:changed");
    return id;
  }

  duplicateEntity(id) {
    if (id === null || id === undefined) return;
    const snap = this.world.snapshotEntity(id);
    const newId = this.world.createEntity();
    for (const [name, data] of Object.entries(snap.components)) {
      const Class = COMPONENT_REGISTRY[name];
      if (Class) this.world.addComponent(newId, Class.deserialize(data));
    }
    const tag = this.world.getComponent(newId, TagComponent);
    if (tag) tag.name = tag.name + " Copy";
    // Only offset non-light entities — lights stay at same position as origin
    if (!this.world.hasComponent(newId, LightComponent)) {
      const t = this.world.getComponent(newId, TransformComponent);
      if (t) { t.position.x += 0.5; t.position.z += 0.5; }
    }
    const newObj = this.renderSystem.createObjectForEntity(newId);
    // Ensure all editor icons on the new entity are visible (safety reset)
    newObj?.traverse(child => { if (child.userData.isEditorIcon) child.visible = true; });
    if (this.#viewMode !== 'default') {
      if (newObj) this.#applyViewModeToObject(newObj, this.#viewMode);
    }
    this.commandManager.push(new SpawnCommand(this, newId));
    this.emit("hierarchy:changed");
    this.selectEntity(newId);
    return newId;
  }

  copyEntity() {
    const id = this.selectedEntityId;
    if (id === null) return;
    this.#clipboard = { type: "entity", snap: this.world.snapshotEntity(id) };
  }

  pasteEntity() {
    if (!this.#clipboard || this.#clipboard.type !== "entity") return;
    const snap = this.#clipboard.snap;
    const newId = this.world.createEntity();
    for (const [name, data] of Object.entries(snap.components)) {
      const Class = COMPONENT_REGISTRY[name];
      if (Class) this.world.addComponent(newId, Class.deserialize(data));
    }
    const tag = this.world.getComponent(newId, TagComponent);
    if (tag) tag.name = tag.name + " Copy";
    // Only offset non-light entities — lights stay at same position as origin
    if (!this.world.hasComponent(newId, LightComponent)) {
      const t = this.world.getComponent(newId, TransformComponent);
      if (t) { t.position.x += 0.5; t.position.z += 0.5; }
    }
    const pastedObj = this.renderSystem.createObjectForEntity(newId);
    // Ensure all editor icons on the new entity are visible (safety reset)
    pastedObj?.traverse(child => { if (child.userData.isEditorIcon) child.visible = true; });
    if (this.#viewMode !== 'default') {
      if (pastedObj) this.#applyViewModeToObject(pastedObj, this.#viewMode);
    }
    this.commandManager.push(new SpawnCommand(this, newId));
    this.emit("hierarchy:changed");
    this.selectEntity(newId);
  }

  #spawnEntityRaw(name, setupFn) {
    const id = this.world.createEntity();
    this.world.addComponent(id, new TagComponent(name));
    this.world.addComponent(id, new TransformComponent());
    setupFn?.(id);
    this.renderSystem.createObjectForEntity(id);
    if (this.#viewMode !== "default") {
      const obj = this.renderSystem.getObject3D(id);
      if (obj) this.#applyViewModeToObject(obj, this.#viewMode);
    }
    return id;
  }

  // Silently restore an entity from a snapshot (for undo/redo — no new command pushed)
  restoreEntitySilent(snapshot) {
    this.world.restoreEntity(snapshot, COMPONENT_REGISTRY);
    this.renderSystem.createObjectForEntity(snapshot.id);
    if (this.#viewMode !== "default") {
      const obj = this.renderSystem.getObject3D(snapshot.id);
      if (obj) this.#applyViewModeToObject(obj, this.#viewMode);
    }
    this.emit("hierarchy:changed");
  }

  // Silently delete an entity (for undo/redo — no new command pushed)
  deleteEntitySilent(entityId) {
    this.#deleteEntityRaw(entityId);
  }

  // Silently rename (for undo/redo)
  renameEntitySilent(entityId, name) {
    const tag = this.world.getComponent(entityId, TagComponent);
    if (tag) {
      tag.name = name;
      this.emit("hierarchy:changed");
    }
  }

  // Capture/apply transform snapshots for undo/redo
  #captureTransform(entityId) {
    const tc = this.world.getComponent(entityId, TransformComponent);
    if (!tc) return null;
    return {
      position: tc.position.clone(),
      rotation: tc.rotation.clone(),
      scale: tc.scale.clone(),
    };
  }

  applyTransformSilent(entityId, snap) {
    if (!snap) return;
    const tc = this.world.getComponent(entityId, TransformComponent);
    if (!tc) return;
    tc.position.copy(snap.position);
    tc.rotation.copy(snap.rotation);
    tc.scale.copy(snap.scale);
    const obj = this.renderSystem.getObject3D(entityId);
    if (obj) {
      obj.position.copy(tc.position);
      obj.rotation.copy(tc.rotation);
      obj.scale.copy(tc.scale);
    }
    if (this.selectedEntityId === entityId) {
      const obj2 = this.renderSystem.getObject3D(entityId);
      if (obj2) this.transformControls.attach(obj2);
    }
    this.emit("entity:changed", entityId);
  }

  spawnCube() {
    return this.spawnEntity("Cube", (id) =>
      this.world.addComponent(id, new MeshComponent("box", 0x888888)),
    );
  }
  spawnSphere() {
    return this.spawnEntity("Sphere", (id) =>
      this.world.addComponent(id, new MeshComponent("sphere", 0x888888)),
    );
  }
  spawnCone() {
    return this.spawnEntity("Cone", (id) =>
      this.world.addComponent(id, new MeshComponent("cone", 0x888888)),
    );
  }
  spawnCylinder() {
    return this.spawnEntity("Cylinder", (id) =>
      this.world.addComponent(id, new MeshComponent("cylinder", 0x888888)),
    );
  }
  spawnCapsule() {
    return this.spawnEntity("Capsule", (id) =>
      this.world.addComponent(id, new MeshComponent("capsule", 0x888888)),
    );
  }
  spawnPlane() {
    return this.spawnEntity("Plane", (id) => {
      this.world.addComponent(id, new MeshComponent("plane", 0x888888));
      const t = this.world.getComponent(id, TransformComponent);
      if (t) {
        t.position.set(0, 0, 0);
        t.rotation.x = -Math.PI / 2;
        t.scale.set(3, 3, 3);
      }
    });
  }
  spawnRamp() {
    return this.spawnEntity("Ramp", (id) =>
      this.world.addComponent(id, new MeshComponent("ramp", 0x888888)),
    );
  }
  spawnBarrel() {
    return this.spawnEntity("Barrel", (id) =>
      this.world.addComponent(id, new MeshComponent("barrel", 0x888888)),
    );
  }
  spawnScrew() {
    return this.spawnEntity("Screw", (id) =>
      this.world.addComponent(id, new MeshComponent("screw", 0x888888)),
    );
  }
  // Use higher default intensities so lights are visible in physical rendering mode
  spawnPointLight() {
    return this.spawnEntity("PointLight", (id) => {
      const t = this.world.getComponent(id, TransformComponent);
      if (t) t.position.set(2, 2, 0);
      this.world.addComponent(id, new LightComponent("point", 0xffffff, 1, 2));
    });
  }
  spawnDirectionalLight() {
    return this.spawnEntity("DirectionalLight", (id) => {
      const t = this.world.getComponent(id, TransformComponent);
      if (t) { t.position.set(3, 4, 3); t.rotation.z = -Math.PI / 4; }
      this.world.addComponent(id, new LightComponent("directional", 0xffffff, 1));
    });
  }
  spawnSpotLight() {
    return this.spawnEntity("SpotLight", (id) => {
      const t = this.world.getComponent(id, TransformComponent);
      if (t) t.position.set(2, 2, 2);
      this.world.addComponent(id, new LightComponent("spot", 0xffffff, 1, 2));
    });
  }
  spawnSphereTrigger() {
    return this.spawnEntity("SphereTrigger", (id) =>
      this.world.addComponent(id, new TriggerComponent("sphere", 1)),
    );
  }
  spawnBoxTrigger() {
    return this.spawnEntity("BoxTrigger", (id) =>
      this.world.addComponent(id, new TriggerComponent("box", 1)),
    );
  }
  spawnPlayerStart() {
    return this.spawnEntity("PlayerStart", (id) =>
      this.world.addComponent(id, new PlayerStartComponent()),
    );
  }
  spawnCamera() {
    return this.spawnEntity("Camera", (id) => {
      const t = this.world.getComponent(id, TransformComponent);
      if (t) t.position.set(0, 3, 5);
      this.world.addComponent(id, new CameraComponent());
    });
  }
  spawnAmbientLight() {
    return this.spawnEntity("AmbientLight", (id) => {
      const t = this.world.getComponent(id, TransformComponent);
      if (t) t.position.set(3, 3, 3);
      this.world.addComponent(id, new LightComponent("ambient", 0xffffff, 0.5));
    });
  }
  spawnFog() {
    return this.spawnEntity("Fog", (id) => {
      const t = this.world.getComponent(id, TransformComponent);
      if (t) t.position.set(-3, 2, 0);
      this.world.addComponent(id, new FogComponent(0xaaaaaa, 10, 100));
    });
  }
  spawnSky() {
    return this.spawnEntity("SkyBox", (id) => {
      const t = this.world.getComponent(id, TransformComponent);
      if (t) t.position.set(-3, 3, 0);
      this.world.addComponent(id, new SkyBoxComponent());
    });
  }

  // Returns true for entity types where scale doesn't apply (camera, lights, sky)
  isScaleLocked(entityId) {
    if (entityId === null) return false;
    return (
      this.world.hasComponent(entityId, CameraComponent) ||
      this.world.hasComponent(entityId, LightComponent) ||
      this.world.hasComponent(entityId, SkyBoxComponent)
    );
  }

  // Returns true for entity types where rotation doesn't apply (sky)
  isRotationLocked(entityId) {
    if (entityId === null) return false;
    return this.world.hasComponent(entityId, SkyBoxComponent);
  }

  isEntityVisible(entityId) {
    return this.renderSystem.getObject3D(entityId)?.visible !== false;
  }

  toggleEntityVisibility(entityId) {
    const obj = this.renderSystem.getObject3D(entityId);
    if (!obj) return;
    obj.visible = !obj.visible;
    this.emit("hierarchy:changed");
  }

  deleteEntity(entityId) {
    // Guard: at least one camera must remain in the scene
    if (this.world.getComponent(entityId, CameraComponent)) {
      const camCount = this.world.entities.filter((id) =>
        this.world.getComponent(id, CameraComponent),
      ).length;
      if (camCount <= 1) {
        this.emit("notification", "Every scene must have at least one camera.");
        return;
      }
    }
    const cmd = new DeleteCommand(this, entityId);
    this.#deleteEntityRaw(entityId);
    this.commandManager.push(cmd);
  }

  #deleteEntityRaw(entityId) {
    if (this.selectedEntityId === entityId) this.selectEntity(null);
    this.selectedEntityIds.delete(entityId);
    const helper = this.#helpers.get(entityId);
    if (helper) {
      this.threeScene.remove(helper);
      helper.dispose?.();
      this.#helpers.delete(entityId);
    }
    const groupComp = this.world.getComponent(entityId, GroupComponent);
    if (groupComp) {
      const children = this.world.entities.filter((id) => {
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
    this.emit("hierarchy:changed");
  }

  renameEntity(entityId, name) {
    const tag = this.world.getComponent(entityId, TagComponent);
    if (!tag) return;
    const before = tag.name;
    tag.name = name;
    this.commandManager.push(new RenameCommand(this, entityId, before, name));
    this.emit("hierarchy:changed");
  }

  rebuildEntityObject(entityId) {
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

    if (this.#viewMode !== "default" && obj)
      this.#applyViewModeToObject(obj, this.#viewMode);

    if (this.selectedEntityId === entityId) {
      if (obj) this.transformControls.attach(obj);
    }
  }

  // --- Visual update helpers ---

  updateEntityColor(entityId, color) {
    const obj = this.renderSystem.getObject3D(entityId);
    if (!obj) return;
    obj.traverse((child) => {
      if (child.isMesh && child.material && !child.userData.isEditorIcon) {
        const hex = parseInt(color.replace("#", ""), 16);
        if (child.userData._origMat) {
          child.userData._origMat.color.set(hex);
          if (this.#viewMode !== "default") child.material.color.set(hex);
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
    if (!lightComp) return;

    if (lightComp.type === "point" || lightComp.type === "spot") {
      // Rebuild to update range visualization (rings for point, cone for spot)
      this.rebuildEntityObject(entityId);
      return;
    }

    // Directional: update light ref in-place
    const obj = this.renderSystem.getObject3D(entityId);
    const lightRef = obj?.userData.lightRef;
    if (lightRef) {
      lightRef.color.set(lightComp.color);
      lightRef.intensity = lightComp.intensity;
    }
  }

  updateEntityCamera(entityId) {
    const camComp = this.world.getComponent(entityId, CameraComponent);
    const obj = this.renderSystem.getObject3D(entityId);
    if (!obj || !camComp) return;
    this.#syncCameraRef(entityId, obj, camComp);
  }

  // --- Scene settings ---

  getSceneName() {
    return this.#currentScene()?.name ?? "Scene";
  }

  getSceneBackground() {
    const bg = this.threeScene.background;
    if (bg && bg.isColor) return "#" + bg.getHexString();
    return "#1a1a1a";
  }

  setSceneBackground(hexStr) {
    this.threeScene.background = new THREE.Color(hexStr);
    const scene = this.#currentScene();
    if (scene) scene.background = hexStr;
  }

  // --- Scene management ---

  #ensureSceneHasCamera() {
    const hasCam = this.world.entities.some((id) =>
      this.world.getComponent(id, CameraComponent),
    );
    if (!hasCam) {
      const camId = this.world.createEntity();
      this.world.addComponent(camId, new TagComponent("Camera"));
      const t = new TransformComponent();
      t.position.set(0, 2, 5);
      this.world.addComponent(camId, t);
      this.world.addComponent(camId, new CameraComponent());
      this.renderSystem.createObjectForEntity(camId);

      const lightId = this.world.createEntity();
      this.world.addComponent(lightId, new TagComponent("Directional Light"));
      const lt = new TransformComponent();
      lt.position.set(3, 6, 4);
      this.world.addComponent(lightId, lt);
      this.world.addComponent(
        lightId,
        new LightComponent("directional", 0xffffff, 1),
      );
      this.renderSystem.createObjectForEntity(lightId);
    }
  }

  #spawnDefaultScene() {
    // Camera
    const camId = this.world.createEntity();
    this.world.addComponent(camId, new TagComponent("Camera"));
    const ct = new TransformComponent();
    ct.position.set(0, 2, 10);
    this.world.addComponent(camId, ct);
    this.world.addComponent(camId, new CameraComponent());
    this.renderSystem.createObjectForEntity(camId);

    // Directional Light
    const dlId = this.world.createEntity();
    this.world.addComponent(dlId, new TagComponent("Directional Light"));
    const dt = new TransformComponent();
    dt.position.set(3, 6, 4);
    dt.rotation.z = -Math.PI / 4;
    this.world.addComponent(dlId, dt);
    this.world.addComponent(dlId, new LightComponent("directional", 0xffffff, 1));
    this.renderSystem.createObjectForEntity(dlId);

    // Ambient Light
    const alId = this.world.createEntity();
    this.world.addComponent(alId, new TagComponent("Ambient Light"));
    this.world.addComponent(alId, new TransformComponent());
    this.world.addComponent(alId, new LightComponent("ambient", 0xffffff, 0.5));
    this.renderSystem.createObjectForEntity(alId);

    // SkyBox
    const skyId = this.world.createEntity();
    this.world.addComponent(skyId, new TagComponent("SkyBox"));
    this.world.addComponent(skyId, new TransformComponent());
    this.world.addComponent(skyId, new SkyBoxComponent());
    this.renderSystem.createObjectForEntity(skyId);

    // Cube
    const cubeId = this.world.createEntity();
    this.world.addComponent(cubeId, new TagComponent("Cube"));
    const cubet = new TransformComponent();
    cubet.position.set(0, 0.5, 0);
    this.world.addComponent(cubeId, cubet);
    this.world.addComponent(cubeId, new MeshComponent("box", 0x4a9eff));
    this.renderSystem.createObjectForEntity(cubeId);

    // Floor box
    const floorId = this.world.createEntity();
    this.world.addComponent(floorId, new TagComponent("Floor"));
    const ft = new TransformComponent();
    ft.position.set(0, -0.5, 0);
    ft.scale.set(50, 1, 50);
    this.world.addComponent(floorId, ft);
    this.world.addComponent(floorId, new MeshComponent("box", 0x888888));
    this.renderSystem.createObjectForEntity(floorId);
  }

  #loadCurrentScene() {
    this.#clearHelpers();
    const scene = this.#currentScene();
    if (scene?.worldData) {
      this.world.restore(scene.worldData, COMPONENT_REGISTRY);
      this.renderSystem.rebuildAll();
      this.#ensureSceneHasCamera();
    } else {
      this.world.clear();
      this.renderSystem.rebuildAll();
      this.#spawnDefaultScene();
    }
    // Restore scene background
    if (scene?.background) {
      this.threeScene.background = new THREE.Color(scene.background);
    } else {
      this.threeScene.background = new THREE.Color(0x1a1a1a);
    }
    // Restore per-scene editor camera
    if (scene?.editorCamera) {
      this.camera.position.fromArray(scene.editorCamera.position);
      this.orbitControls.target.fromArray(scene.editorCamera.target);
      this.orbitControls.update();
    } else {
      this.camera.position.set(5, 5, 8);
      this.orbitControls.target.set(0, 0, 0);
      this.orbitControls.update();
    }
    // Re-apply view mode after rebuild
    if (this.#viewMode !== "default") {
      for (const [, obj] of this.renderSystem.entityObjects) {
        this.#applyViewModeToObject(obj, this.#viewMode);
      }
    }
    this.selectEntity(null);
    this.emit("hierarchy:changed");
  }

  saveCurrentScene() {
    const scene = this.#currentScene();
    if (scene) {
      scene.worldData = this.world.snapshot();
      scene.background = this.getSceneBackground();
      try {
        scene.thumbnail = this.renderer.domElement.toDataURL("image/jpeg", 0.4);
      } catch (e) {
        /* WebGPU may not support toDataURL in all browsers */
      }
      this.emit("scene:saved");
    }
  }

  saveProject() {
    this.saveCurrentScene();
    this.emit("project:saved");
    return this.project;
  }

  switchScene(sceneIndex) {
    this.saveCurrentScene();
    this.project.currentSceneIndex = sceneIndex;
    this.#loadCurrentScene();
    this.commandManager.clear();
    this.emit("scene:switched", sceneIndex);
    this.emit("scenes:changed");
  }

  addScene(name, copyCurrentScene = false) {
    const newScene = {
      id: uuid(),
      name,
      worldData: copyCurrentScene ? this.world.snapshot() : null,
      background: copyCurrentScene ? this.getSceneBackground() : undefined,
    };
    this.project.scenes.push(newScene);
    this.emit("scenes:changed");
    return this.project.scenes.length - 1;
  }

  deleteScene(sceneIndex) {
    if (this.project.scenes.length <= 1) return;
    this.project.scenes.splice(sceneIndex, 1);
    if (this.project.currentSceneIndex >= this.project.scenes.length) {
      this.project.currentSceneIndex = this.project.scenes.length - 1;
    }
    this.#loadCurrentScene();
    this.commandManager.clear();
    this.emit("scenes:changed");
  }

  insertSceneSilent(scene, index) {
    const scenes = this.project.scenes;
    if (index >= scenes.length) {
      scenes.push(scene);
    } else {
      scenes.splice(index, 0, scene);
    }
    this.emit("scenes:changed");
  }

  renameScene(sceneIndex, name) {
    const s = this.project.scenes[sceneIndex];
    if (s) {
      s.name = name;
      this.emit("scenes:changed");
    }
  }

  #currentScene() {
    return this.project.scenes[this.project.currentSceneIndex] ?? null;
  }

  get currentSceneIndex() {
    return this.project.currentSceneIndex;
  }

  // --- Events ---

  on(event, fn) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    this.#listeners.get(event)?.delete(fn);
  }

  emit(event, ...args) {
    this.#listeners.get(event)?.forEach((fn) => fn(...args));
  }

  // --- Cleanup ---

  destroy() {
    cancelAnimationFrame(this.#animFrameId);
    this.#resizeObserver?.disconnect();
    this.#clearHelpers();
    this.renderer.domElement.removeEventListener("pointerdown", this.#onPointerDown);
    this.renderer.domElement.removeEventListener("pointermove", this.#onPointerMove);
    this.renderer.domElement.removeEventListener("pointerup",   this.#onPointerUp);
    this.renderer.domElement.removeEventListener("pointermove", this.#onGizmoCursor);
    this.orbitControls.dispose();
    this.transformControls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.#cameraPreviewOverlay?.remove();
    this.#listeners.clear();
  }
}
