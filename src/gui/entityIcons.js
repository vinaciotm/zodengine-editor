import { LightComponent } from '../components/LightComponent.js';
import { CameraComponent } from '../components/CameraComponent.js';
import { FogComponent } from '../components/FogComponent.js';
import { SkyBoxComponent } from '../components/SkyBoxComponent.js';
import { MeshComponent } from '../components/MeshComponent.js';

const _cache = new Map();

export function getEntityIconType(entityId, world) {
  const light = world.getComponent(entityId, LightComponent);
  if (light) return 'light_' + light.type;
  if (world.hasComponent(entityId, CameraComponent)) return 'camera';
  if (world.hasComponent(entityId, FogComponent)) return 'fog';
  if (world.hasComponent(entityId, SkyBoxComponent)) return 'sky';
  const mesh = world.getComponent(entityId, MeshComponent);
  if (mesh) return 'mesh_' + mesh.type;
  return null;
}

export function iconURL(type) {
  if (_cache.has(type)) return _cache.get(type);
  const url = drawIconCanvas(type);
  _cache.set(type, url);
  return url;
}

export function drawIconCanvas(type) {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2;

  if (type === 'light_directional') {
    ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9);
      ctx.lineTo(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(cx - 1, cy - 1, 1, cx, cy, 8);
    g.addColorStop(0, '#fff8cc'); g.addColorStop(0.4, '#ffdd00'); g.addColorStop(1, '#ff8800');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();

  } else if (type === 'light_ambient') {
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, 14);
    g.addColorStop(0, '#fffde0'); g.addColorStop(0.5, 'rgba(255,229,102,0.5)'); g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,80,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.stroke();

  } else if (type === 'light_point') {
    const g = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 10);
    g.addColorStop(0, '#fffde0'); g.addColorStop(0.4, '#ffe566'); g.addColorStop(1, '#ff8000');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,180,50,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 4, cy + 9); ctx.lineTo(cx + 4, cy + 9); ctx.stroke();
    ctx.fillStyle = '#888';
    ctx.fillRect(cx - 3, cy + 9, 6, 2);

  } else if (type === 'light_spot') {
    ctx.fillStyle = 'rgba(255,220,80,0.5)';
    ctx.beginPath(); ctx.moveTo(cx, 5); ctx.lineTo(cx - 10, 26); ctx.lineTo(cx + 10, 26); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,80,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, 5); ctx.lineTo(cx - 10, 26); ctx.moveTo(cx, 5); ctx.lineTo(cx + 10, 26); ctx.stroke();
    const lg = ctx.createRadialGradient(cx - 1, 5, 1, cx, 5, 5);
    lg.addColorStop(0, '#ffffff'); lg.addColorStop(1, '#ffcc44');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(cx, 5, 5, 0, Math.PI * 2); ctx.fill();

  } else if (type === 'camera') {
    const g = ctx.createLinearGradient(3, 8, 3, 22);
    g.addColorStop(0, '#5a9adc'); g.addColorStop(1, '#1a4a88');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(3, 8, 18, 13, 2); ctx.fill();
    ctx.strokeStyle = '#88ccff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(3, 8, 18, 13, 2); ctx.stroke();
    const lg = ctx.createRadialGradient(cx - 0.5, cy + 1, 1, cx, cy + 1, 5);
    lg.addColorStop(0, '#bbddff'); lg.addColorStop(0.5, '#2277bb'); lg.addColorStop(1, '#081828');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(cx, cy + 1, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#44aadd'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy + 1, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ff3333';
    ctx.beginPath(); ctx.arc(cx - 1, 6, 2, 0, Math.PI * 2); ctx.fill();

  } else if (type === 'sky') {
    const bg = ctx.createLinearGradient(0, 0, 0, size);
    bg.addColorStop(0, '#1a78c8'); bg.addColorStop(0.6, '#5ab4f0'); bg.addColorStop(1, '#f0e8c8');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
    const sg = ctx.createRadialGradient(cx - 1, cy - 5, 1, cx, cy - 5, 5);
    sg.addColorStop(0, '#fff8cc'); sg.addColorStop(0.4, '#ffdd00'); sg.addColorStop(1, '#ff8800');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(cx, cy - 5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.ellipse(cx + 2, cy + 7, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - 3, cy + 6, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(100,180,255,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.stroke();

  } else if (type === 'fog') {
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 14);
    glow.addColorStop(0, 'rgba(160,190,210,0.3)'); glow.addColorStop(1, 'rgba(160,190,210,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
    const layers = [{ y: cy - 5, w: 20, h: 4.5 }, { y: cy, w: 26, h: 5 }, { y: cy + 6, w: 18, h: 4 }];
    for (const l of layers) {
      const g = ctx.createLinearGradient(cx - l.w / 2, 0, cx + l.w / 2, 0);
      g.addColorStop(0, 'rgba(200,215,230,0)'); g.addColorStop(0.2, 'rgba(200,215,230,0.85)');
      g.addColorStop(0.8, 'rgba(200,215,230,0.85)'); g.addColorStop(1, 'rgba(200,215,230,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(cx, l.y + l.h / 2, l.w / 2, l.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(140,175,200,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.stroke();

  } else if (type === 'mesh_box') {
    const s = 7;
    const ox = cx, oy = cy + 1;
    const iso = (x, y, z) => [ox + (x - z) * s * 0.866, oy + (x + z) * s * 0.5 - y * s];
    const TFL = iso(-1, 1, 1), TFR = iso(1, 1, 1), TBR = iso(1, 1, -1), TBL = iso(-1, 1, -1);
    const BFL = iso(-1, -1, 1), BFR = iso(1, -1, 1), BBR = iso(1, -1, -1);
    const poly = (pts, fill, stroke) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.7; ctx.stroke(); }
    };
    poly([TFL, TFR, TBR, TBL], '#6aaee0', '#9dccf0');  // top
    poly([TFR, BFR, BBR, TBR], '#3a7ab8', '#6aaae0');  // right
    poly([TFL, TFR, BFR, BFL], '#2a5c98', '#5090cc');  // front

  } else if (type === 'mesh_sphere') {
    const r = 12;
    const g = ctx.createRadialGradient(cx - 4, cy - 4, 1, cx, cy, r);
    g.addColorStop(0, '#ddeeff'); g.addColorStop(0.35, '#6abbe0'); g.addColorStop(0.75, '#2a6aaa');
    g.addColorStop(1, '#0a2a50');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(150,210,255,0.35)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.28, r, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(cx - 4, cy - 5, 3, 2, -0.5, 0, Math.PI * 2); ctx.fill();

  } else if (type === 'mesh_cone') {
    const bx = cx, by = cy + 9, brx = 11, bry = 4, apexY = cy - 11;
    const g = ctx.createLinearGradient(cx - 11, 0, cx + 11, 0);
    g.addColorStop(0, '#2a5c98'); g.addColorStop(0.45, '#5090cc'); g.addColorStop(0.55, '#6aabe0');
    g.addColorStop(1, '#2a5c98');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, apexY);
    ctx.lineTo(bx - brx, by);
    ctx.ellipse(bx, by, brx, bry, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    // Base ellipse
    ctx.strokeStyle = '#88bbdd'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(bx, by, brx, bry, 0, 0, Math.PI * 2); ctx.stroke();
    // Apex lines
    ctx.strokeStyle = '#aaddff'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, apexY); ctx.lineTo(bx - brx, by);
    ctx.moveTo(cx, apexY); ctx.lineTo(bx + brx, by);
    ctx.stroke();
    // Base cap fill
    const capG = ctx.createRadialGradient(bx - 2, by - 1, 1, bx, by, brx);
    capG.addColorStop(0, '#5090cc'); capG.addColorStop(1, '#2a5c98');
    ctx.fillStyle = capG;
    ctx.beginPath(); ctx.ellipse(bx, by, brx, bry, 0, 0, Math.PI * 2); ctx.fill();

  } else if (type === 'mesh_cylinder') {
    const rx = 11, ry = 3.5, topY = cy - 9, botY = cy + 9;
    const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
    g.addColorStop(0, '#2a5c98'); g.addColorStop(0.4, '#5090cc'); g.addColorStop(0.6, '#6aabe0');
    g.addColorStop(1, '#2a5c98');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - rx, topY);
    ctx.lineTo(cx - rx, botY);
    ctx.ellipse(cx, botY, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(cx + rx, topY);
    ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI, true);
    ctx.closePath(); ctx.fill();
    const tg = ctx.createRadialGradient(cx - 3, topY - 1, 1, cx, topY, rx);
    tg.addColorStop(0, '#bbddff'); tg.addColorStop(1, '#4a8acc');
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#88bbdd'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, botY, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();

  } else if (type === 'mesh_capsule') {
    const rx = 9, capR = 9, halfH = 7;
    const topCy = cy - halfH, botCy = cy + halfH;
    const ry = 3.2;
    const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
    g.addColorStop(0, '#2a5c98'); g.addColorStop(0.4, '#5090cc'); g.addColorStop(0.6, '#6aabe0');
    g.addColorStop(1, '#2a5c98');
    // Side body
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - rx, topCy); ctx.lineTo(cx - rx, botCy);
    ctx.ellipse(cx, botCy, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(cx + rx, topCy);
    ctx.ellipse(cx, topCy, rx, ry, 0, 0, Math.PI, true);
    ctx.closePath(); ctx.fill();
    // Top dome
    const tg = ctx.createRadialGradient(cx - 3, topCy - 3, 1, cx, topCy, capR);
    tg.addColorStop(0, '#cceeff'); tg.addColorStop(1, '#3a7ac0');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.arc(cx, topCy, capR, Math.PI, 0);
    ctx.ellipse(cx, topCy, rx, ry, 0, 0, Math.PI);
    ctx.closePath(); ctx.fill();
    // Bottom dome
    ctx.fillStyle = '#2a5c98';
    ctx.beginPath();
    ctx.arc(cx, botCy, capR, 0, Math.PI);
    ctx.ellipse(cx, botCy, rx, ry, 0, Math.PI, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#88bbdd'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(cx - rx, topCy); ctx.lineTo(cx - rx, botCy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + rx, topCy); ctx.lineTo(cx + rx, botCy); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, topCy, capR, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, botCy, capR, 0, Math.PI); ctx.stroke();

  } else if (type === 'mesh_plane') {
    const pts = [[cx - 13, cy + 7], [cx + 13, cy + 7], [cx + 9, cy - 7], [cx - 9, cy - 7]];
    const g = ctx.createLinearGradient(0, cy - 7, 0, cy + 7);
    g.addColorStop(0, '#4a8acc'); g.addColorStop(1, '#2a5c88');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill();
    // Grid lines
    ctx.strokeStyle = 'rgba(150,200,255,0.4)'; ctx.lineWidth = 0.6;
    for (const t of [1/3, 2/3]) {
      const xl = pts[0][0] + (pts[3][0] - pts[0][0]) * t;
      const xr = pts[1][0] + (pts[2][0] - pts[1][0]) * t;
      const yl = pts[0][1] + (pts[3][1] - pts[0][1]) * t;
      const yr = pts[1][1] + (pts[2][1] - pts[1][1]) * t;
      ctx.beginPath(); ctx.moveTo(xl, yl); ctx.lineTo(xr, yr); ctx.stroke();
    }
    for (const t of [1/3, 2/3]) {
      const xt = pts[3][0] + (pts[2][0] - pts[3][0]) * t;
      const xb = pts[0][0] + (pts[1][0] - pts[0][0]) * t;
      const yt = pts[3][1] + (pts[2][1] - pts[3][1]) * t;
      const yb = pts[0][1] + (pts[1][1] - pts[0][1]) * t;
      ctx.beginPath(); ctx.moveTo(xt, yt); ctx.lineTo(xb, yb); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(150,200,255,0.7)'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.stroke();
  }

  return canvas.toDataURL();
}
