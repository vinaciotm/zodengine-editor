import * as THREE from 'three/webgpu';
import { TransformComponent } from '../components/TransformComponent.js';
import { MeshComponent } from '../components/MeshComponent.js';
import { LightComponent } from '../components/LightComponent.js';
import { TriggerComponent } from '../components/TriggerComponent.js';
import { PlayerStartComponent } from '../components/PlayerStartComponent.js';
import { GroupComponent } from '../components/GroupComponent.js';
import { CameraComponent } from '../components/CameraComponent.js';
import { FogComponent } from '../components/FogComponent.js';
import { SkyBoxComponent } from '../components/SkyBoxComponent.js';
import { SkyMesh } from '../vendor/SkyMeshPatched.js';

export class RenderSystem {
  world = null;
  scene = null;
  renderer = null;
  entityObjects = new Map();
  lightingEnabled = true;
  shadowsEnabled = true;
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
      if (obj.userData.isSkyEntity) this.#removeSkyMesh(obj);
      if (obj.parent) obj.parent.remove(obj);
      else this.scene.remove(obj);
      this.entityObjects.delete(entityId);
    }
  }

  #removeSkyMesh(markerObj) {
    const sky = markerObj.userData.skyMeshRef;
    if (sky && sky.parent) sky.parent.remove(sky);
    markerObj.userData.skyMeshRef = null;
  }

  rebuildAll() {
    // Clear scene-level effects that are driven by entity components
    this.scene.fog = null;
    // Remove any existing sky meshes
    for (const obj of this.entityObjects.values()) {
      if (obj.userData.isSkyEntity) this.#removeSkyMesh(obj);
    }

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

  // Hide all editor-only visual indicators (sprites, line groups, range rings, editor-only entities)
  hideEditorIcons() {
    for (const obj of this.entityObjects.values()) {
      if (obj.userData.isEditorOnly) {
        obj.visible = false;
      } else {
        obj.traverse(child => {
          if (child.userData.isEditorIcon) child.visible = false;
        });
      }
    }
  }

  // Show or hide all editor visuals (for runtime debug toggle)
  setEditorVisualsVisible(visible) {
    for (const obj of this.entityObjects.values()) {
      if (obj.userData.isEditorOnly) {
        obj.visible = visible;
      } else {
        obj.traverse(child => {
          if (child.userData.isEditorIcon) child.visible = visible;
        });
      }
    }
  }

  update() {
    for (const [entityId, obj] of this.entityObjects) {
      // Fog entities: update scene.fog from component values (only in lit mode)
      if (obj.userData.isFogEntity) {
        if (this.lightingEnabled && obj.visible) {
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
        // Apply transform so the marker icon moves with the entity
        const ft = this.world?.getComponent(entityId, TransformComponent);
        if (ft) { obj.position.copy(ft.position); obj.rotation.copy(ft.rotation); }
        continue;
      }

      // Sky entities: sync SkyMesh uniforms
      if (obj.userData.isSkyEntity) {
        const skyMeshRef = obj.userData.skyMeshRef;
        if (!obj.visible) {
          if (skyMeshRef && skyMeshRef.parent) skyMeshRef.parent.remove(skyMeshRef);
          // Still apply transform to move the invisible marker
          const st = this.world?.getComponent(entityId, TransformComponent);
          if (st) { obj.position.copy(st.position); }
          continue;
        } else if (skyMeshRef && !skyMeshRef.parent) {
          this.scene.add(skyMeshRef);
        }
        const sky = this.world?.getComponent(entityId, SkyBoxComponent);
        if (sky && obj.userData.skyMeshRef) {
          const m = obj.userData.skyMeshRef;
          m.turbidity.value = sky.turbidity;
          m.rayleigh.value = sky.rayleigh;
          m.mieCoefficient.value = sky.mieCoefficient;
          m.mieDirectionalG.value = sky.mieDirectionalG;
          m.cloudCoverage.value = sky.cloudCoverage;
          m.cloudDensity.value = sky.cloudDensity;
          m.cloudElevation.value = sky.cloudElevation;
          const phi = THREE.MathUtils.degToRad(90 - sky.elevation);
          const theta = THREE.MathUtils.degToRad(sky.azimuth);
          m.sunPosition.value.setFromSphericalCoords(1, phi, theta);
          if (this.renderer) this.renderer.toneMappingExposure = sky.exposure;
        }
        // Apply transform so the marker icon moves with the entity
        const st = this.world?.getComponent(entityId, TransformComponent);
        if (st) { obj.position.copy(st.position); obj.rotation.copy(st.rotation); }
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
    const sky = w?.getComponent(entityId, SkyBoxComponent);

    if (group) return new THREE.Group();
    if (mesh) return this.#makeMesh(mesh);
    if (light) return this.#makeLight(light);
    if (camera) return this.#makeCamera(camera);
    if (trigger) return this.#makeTrigger(trigger);
    if (player) return this.#makePlayerStart();
    if (fog) {
      const marker = new THREE.Object3D();
      marker.userData.isFogEntity = true;
      const fogSprite = this.#makeFogSprite();
      fogSprite.userData.isEditorIcon = true;
      fogSprite.userData.baseScale = 0.07;
      marker.add(fogSprite);
      this.scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);
      return marker;
    }
    if (sky) {
      const marker = new THREE.Object3D();
      marker.userData.isSkyEntity = true;
      const sprite = this.#makeSkySprite();
      sprite.userData.isEditorIcon = true;
      sprite.userData.baseScale = 0.07;
      marker.add(sprite);
      const skyMesh = new SkyMesh();
      skyMesh.material.fog = false;
      skyMesh.scale.setScalar(450000);
      skyMesh.turbidity.value = sky.turbidity;
      skyMesh.rayleigh.value = sky.rayleigh;
      skyMesh.mieCoefficient.value = sky.mieCoefficient;
      skyMesh.mieDirectionalG.value = sky.mieDirectionalG;
      skyMesh.cloudCoverage.value = sky.cloudCoverage;
      skyMesh.cloudDensity.value = sky.cloudDensity;
      skyMesh.cloudElevation.value = sky.cloudElevation;
      const phi = THREE.MathUtils.degToRad(90 - sky.elevation);
      const theta = THREE.MathUtils.degToRad(sky.azimuth);
      skyMesh.sunPosition.value.setFromSphericalCoords(1, phi, theta);
      this.scene.add(skyMesh);
      marker.userData.skyMeshRef = skyMesh;
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

    // Ambient light: scene-wide, no position/shadow — but add a sprite icon for editor
    if (comp.type === 'ambient') {
      const light = new THREE.AmbientLight(comp.color, comp.intensity);
      grp.add(light);
      grp.userData.lightRef = light;
      const sprite = this.#makeLightSprite('ambient');
      sprite.userData.isEditorIcon = true;
      sprite.userData.baseScale = 0.07;
      grp.add(sprite);
      return grp;
    }

    let light;

    switch (comp.type) {
      case 'directional': {
        light = new THREE.DirectionalLight(comp.color, comp.intensity);
        if (this.shadowsEnabled) {
          light.shadow.mapSize.setScalar(4096);
          light.shadow.camera.near = 0.1;
          light.shadow.camera.far = 100;
          light.shadow.camera.left = -15;
          light.shadow.camera.right = 15;
          light.shadow.camera.top = 15;
          light.shadow.camera.bottom = -15;
          light.shadow.bias = -0.0003;
          light.shadow.normalBias = 0.02;
        }
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
        if (this.shadowsEnabled) {
          light.shadow.mapSize.setScalar(512);
          light.shadow.camera.near = 0.1;
          light.shadow.camera.far = Math.max((comp.distance ?? 1) * 4, 20);
          light.shadow.bias = -0.0003;
          light.shadow.normalBias = 0.02;
        }
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
        if (this.shadowsEnabled) {
          light.shadow.mapSize.setScalar(512);
          light.shadow.camera.near = 0.1;
          light.shadow.camera.far = Math.max((comp.distance ?? 1) * 4, 20);
          light.shadow.bias = -0.0003;
          light.shadow.normalBias = 0.02;
        }
        const rings = this.#makePointLightRings(comp.distance ?? 1);
        grp.add(rings);
        grp.userData.rangeRingsRef = rings;
        break;
      }
    }

    light.castShadow = this.shadowsEnabled;
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
      color: 0xffffff, transparent: true, opacity: 0.15, depthWrite: false,
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
      color: 0xffffff, transparent: true, opacity: 0.15, depthWrite: false,
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
      color: 0xffffff, transparent: true, opacity: 0.15, depthWrite: false,
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
    grp.userData.isEditorOnly = true;
    const cam = new THREE.PerspectiveCamera(comp.fov, 1, comp.near, comp.far);
    cam.updateProjectionMatrix();
    grp.add(cam);
    grp.userData.camRef = cam;

    // Red laser: camera look direction (along -Z)
    const laser = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -(comp.far ?? 100) * 0.35),
      ]),
      new THREE.LineBasicMaterial({ color: 0xff1a1a, transparent: true, opacity: 0.18, depthWrite: false })
    );
    laser.userData.isEditorIcon = true;
    grp.add(laser);

    const sprite = this.#makeCameraSprite();
    sprite.userData.isEditorIcon = true;
    sprite.userData.baseScale = 0.08;
    grp.add(sprite);

    return grp;
  }

  // Retro video camera sprite — matches entityIcons camera style
  #makeCameraSprite() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    // Draw in 32-unit space, scaled 4× to fill 128px canvas
    ctx.scale(4, 4);
    const cx = 16, cy = 16;
    const s = 3.8, ox = cx - 1, oy = cy + 3;
    const iso = (x, y, z) => [ox + (x - z) * s * 0.866, oy + (x + z) * s * 0.5 - y * s];
    const poly = (pts, fill, stroke, lw = 0.8) => {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
    };
    const B = { w: 1.6, h: 0.6, d: 1.0 };
    const TFL=iso(-B.w,B.h,B.d), TFR=iso(B.w,B.h,B.d), TBR=iso(B.w,B.h,-B.d), TBL=iso(-B.w,B.h,-B.d);
    const BFL=iso(-B.w,-B.h,B.d), BFR=iso(B.w,-B.h,B.d), BBR=iso(B.w,-B.h,-B.d);
    poly([TFL,TFR,TBR,TBL], '#8080c0', '#a0a0d4');
    poly([TFR,BFR,BBR,TBR], '#484890', '#6868b0');
    poly([TFL,TFR,BFR,BFL], '#6060a8', '#8080c0');
    // Dual lenses
    const l1 = iso(-0.8, 0.05, B.d);
    const l2 = iso( 0.55, 0.05, B.d);
    for (const lc of [l1, l2]) {
      ctx.strokeStyle = '#282848'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(lc[0], lc[1], 4.2, 0, Math.PI * 2); ctx.stroke();
      const lg = ctx.createRadialGradient(lc[0] - 1.2, lc[1] - 1.2, 0.4, lc[0], lc[1], 4.0);
      lg.addColorStop(0, '#bcc0e8'); lg.addColorStop(0.4, '#7880b8'); lg.addColorStop(1, '#282850');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lc[0], lc[1], 4.0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.ellipse(lc[0] - 1.3, lc[1] - 1.3, 1.4, 0.9, -0.5, 0, Math.PI * 2); ctx.fill();
    }
    // Yellow viewfinder screen
    const YTL=iso(B.w,0.45,-0.2), YTR=iso(B.w,0.45,-0.9);
    const YBL=iso(B.w,-0.15,-0.2), YBR=iso(B.w,-0.15,-0.9);
    poly([YTL,YTR,YBR,YBL], '#f0c030', '#c09010', 0.7);
    const scg = ctx.createLinearGradient(YTL[0], YTL[1], YBR[0], YBR[1]);
    scg.addColorStop(0, 'rgba(255,255,200,0.5)'); scg.addColorStop(1, 'rgba(180,130,0,0)');
    ctx.fillStyle = scg;
    ctx.beginPath(); ctx.moveTo(YTL[0],YTL[1]); ctx.lineTo(YTR[0],YTR[1]); ctx.lineTo(YBR[0],YBR[1]); ctx.lineTo(YBL[0],YBL[1]); ctx.closePath(); ctx.fill();
    // REC dot
    const rd = iso(-B.w + 0.45, B.h + 0.08, 0.2);
    ctx.fillStyle = '#ff2828'; ctx.beginPath(); ctx.arc(rd[0], rd[1], 1.6, 0, Math.PI * 2); ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, sizeAttenuation: false, depthTest: true, transparent: true });
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

    if (type === 'ambient') {
      // Ambient — soft radial glow with outer rings
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 56);
      g.addColorStop(0, 'rgba(255,249,200,0.9)');
      g.addColorStop(0.3, 'rgba(255,229,102,0.5)');
      g.addColorStop(0.7, 'rgba(255,200,80,0.15)');
      g.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, 56, 0, Math.PI * 2); ctx.fill();
      // Core glow
      const core = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, 24);
      core.addColorStop(0, '#fffde0'); core.addColorStop(0.5, '#ffe566'); core.addColorStop(1, 'rgba(255,200,80,0.2)');
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2); ctx.fill();
      // Two soft outer rings
      ctx.strokeStyle = 'rgba(255,220,80,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 38, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,80,0.18)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, 50, 0, Math.PI * 2); ctx.stroke();

    } else if (type === 'directional') {
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
      map: texture, sizeAttenuation: false, depthTest: true, transparent: true, opacity: 1.0,
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
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.isEditorOnly = true;
    return mesh;
  }

  #makeFogSprite() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2, cy = size / 2;
    ctx.clearRect(0, 0, size, size);

    // Background circle glow
    const glow = ctx.createRadialGradient(cx, cy, 5, cx, cy, 52);
    glow.addColorStop(0, 'rgba(160,190,210,0.3)');
    glow.addColorStop(1, 'rgba(160,190,210,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI * 2); ctx.fill();

    // Horizontal mist layers
    const layers = [
      { y: cy - 18, w: 64, h: 10 },
      { y: cy - 6,  w: 80, h: 12 },
      { y: cy + 8,  w: 70, h: 11 },
      { y: cy + 22, w: 56, h: 9  },
    ];
    for (const l of layers) {
      const g = ctx.createLinearGradient(cx - l.w / 2, 0, cx + l.w / 2, 0);
      g.addColorStop(0,   'rgba(200,215,230,0)');
      g.addColorStop(0.2, 'rgba(200,215,230,0.80)');
      g.addColorStop(0.8, 'rgba(200,215,230,0.80)');
      g.addColorStop(1,   'rgba(200,215,230,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, l.y + l.h / 2, l.w / 2, l.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Border circle
    ctx.strokeStyle = 'rgba(140,175,200,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 51, 0, Math.PI * 2); ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture, sizeAttenuation: false, depthTest: true, transparent: true, opacity: 1.0,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.07, 0.07, 1);
    return sprite;
  }

  #makeSkySprite() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2, cy = size / 2;
    ctx.clearRect(0, 0, size, size);

    // Sky background gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, size);
    skyGrad.addColorStop(0, '#1a78c8');
    skyGrad.addColorStop(0.6, '#5ab4f0');
    skyGrad.addColorStop(1, '#f0e8c8');
    ctx.fillStyle = skyGrad;
    ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI * 2); ctx.fill();

    // Sun
    const sunGrad = ctx.createRadialGradient(cx, cy - 14, 3, cx, cy - 14, 18);
    sunGrad.addColorStop(0, '#fff8cc');
    sunGrad.addColorStop(0.4, '#ffdd00');
    sunGrad.addColorStop(1, '#ff8800');
    ctx.fillStyle = sunGrad;
    ctx.beginPath(); ctx.arc(cx, cy - 14, 18, 0, Math.PI * 2); ctx.fill();

    // Rays
    ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r1 = 22, r2 = 30;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r1, cy - 14 + Math.sin(angle) * r1);
      ctx.lineTo(cx + Math.cos(angle) * r2, cy - 14 + Math.sin(angle) * r2);
      ctx.stroke();
    }

    // Cloud
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.ellipse(cx + 10, cy + 24, 20, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - 4, cy + 22, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 24, cy + 26, 12, 8, 0, 0, Math.PI * 2); ctx.fill();

    // Border circle
    ctx.strokeStyle = 'rgba(100,180,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 51, 0, Math.PI * 2); ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture, sizeAttenuation: false, depthTest: true, transparent: true, opacity: 1.0,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.07, 0.07, 1);
    return sprite;
  }

  #makePlayerStart() {
    const group = new THREE.Group();
    group.userData.isEditorOnly = true;

    // Low-poly capsule wireframe (capSegments=2, radialSegments=6)
    const capsuleMat = new THREE.MeshBasicMaterial({ color: 0xffaa33, wireframe: true, opacity: 0.7, transparent: true });
    const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.6, 2, 6), capsuleMat);
    capsule.userData.isEditorOnly = true;
    group.add(capsule);

    // Icon sprite centered on the capsule
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    const s = 4;
    const poleX = 8 * s, poleTop = 3 * s, poleBot = 29 * s;
    ctx.strokeStyle = '#7a8e9e'; ctx.lineWidth = 2.5 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(poleX, poleTop + 2 * s); ctx.lineTo(poleX, poleBot); ctx.stroke();
    ctx.strokeStyle = '#aabccc'; ctx.lineWidth = 1.2 * s;
    ctx.beginPath(); ctx.moveTo(poleX - 0.5 * s, poleTop + 2 * s); ctx.lineTo(poleX - 0.5 * s, poleBot - 4 * s); ctx.stroke();
    ctx.strokeStyle = '#8899aa'; ctx.lineWidth = 2 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(poleX - 5 * s, poleBot); ctx.lineTo(poleX + 5 * s, poleBot); ctx.stroke();
    const kg = ctx.createRadialGradient(poleX - 0.5 * s, poleTop - 0.5 * s, 0.2 * s, poleX, poleTop, 2.5 * s);
    kg.addColorStop(0, '#ddeeff'); kg.addColorStop(1, '#7a8e9e');
    ctx.fillStyle = kg;
    ctx.beginPath(); ctx.arc(poleX, poleTop, 2.5 * s, 0, Math.PI * 2); ctx.fill();
    const fxS = poleX, fyS = (3 + 1) * s;
    const cw = 5 * s, ch = 4 * s, cols = 4, rows = 3;
    const fw = cols * cw, fh = rows * ch;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(fxS + 1.5 * s, fyS + 1.5 * s, fw, fh);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#111111' : '#eeeeee';
        ctx.fillRect(fxS + c * cw, fyS + r * ch, cw, ch);
      }
    }
    const og = ctx.createLinearGradient(fxS, fyS, fxS, fyS + fh);
    og.addColorStop(0, 'rgba(255,255,255,0.18)'); og.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = og; ctx.fillRect(fxS, fyS, fw, fh);
    ctx.strokeStyle = 'rgba(180,210,240,0.8)'; ctx.lineWidth = 0.8 * s;
    ctx.strokeRect(fxS, fyS, fw, fh);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, sizeAttenuation: false, depthTest: true, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.userData.isEditorIcon = true;
    sprite.userData.baseScale = 0.07;
    sprite.scale.set(0.07, 0.07, 1);
    group.add(sprite);

    return group;
  }
}
