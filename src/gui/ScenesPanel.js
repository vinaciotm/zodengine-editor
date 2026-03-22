import { showNewSceneModal, makeCollapsiblePanel, showConfirm } from './utils.js';
import { sfx } from './sfx.js';

let _thumbPlaceholder = null;
function getThumbPlaceholder() {
  if (_thumbPlaceholder) return _thumbPlaceholder;
  const w = 96, h = 60;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1a1f2e'); bg.addColorStop(1, '#0d0f18');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // Grid lines
  ctx.strokeStyle = 'rgba(80,100,140,0.25)'; ctx.lineWidth = 0.5;
  for (let x = 0; x <= w; x += 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  // Simple 3D cube wireframe icon centered
  const cx = w / 2, cy = h / 2 + 2;
  const s = 10, ox = 5, oy = -5;
  ctx.strokeStyle = 'rgba(100,160,230,0.7)'; ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
  // Front face
  ctx.beginPath(); ctx.rect(cx - s, cy - s, s * 2, s * 2); ctx.stroke();
  // Back face offset
  ctx.beginPath(); ctx.rect(cx - s + ox, cy - s + oy, s * 2, s * 2); ctx.stroke();
  // Connecting lines
  for (const [dx, dy] of [[-s, -s], [s, -s], [s, s], [-s, s]]) {
    ctx.beginPath(); ctx.moveTo(cx + dx, cy + dy); ctx.lineTo(cx + dx + ox, cy + dy + oy); ctx.stroke();
  }
  // Label
  ctx.fillStyle = 'rgba(100,140,200,0.55)'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
  ctx.fillText('no preview', cx, h - 5);
  _thumbPlaceholder = canvas.toDataURL();
  return _thumbPlaceholder;
}

export class ScenesPanel {
  #el = null;
  #editor = null;
  #unsubs = [];
  #listEl = null;

  constructor(editor) { this.#editor = editor; }

  mount(parent) {
    this.#el = document.createElement('div');
    this.#el.className = 'panel';
    this.#el.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;';
    parent.appendChild(this.#el);

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `
      <span class="ph-icon">&#127916;</span><span class="ph-text"> Cenários</span>
      <div class="panel-header-actions">
        <button class="btn-icon btn" id="scene-add" title="Add Scene">+</button>
      </div>
    `;
    this.#el.appendChild(header);

    this.#listEl = document.createElement('div');
    this.#listEl.className = 'panel-content';
    this.#listEl.id = 'scenes-list';
    this.#el.appendChild(this.#listEl);

    makeCollapsiblePanel(header, this.#listEl, true, open => open ? sfx.in() : sfx.out());

    header.querySelector('#scene-add').addEventListener('click', async () => {
      const result = await showNewSceneModal();
      if (!result) return;
      const idx = this.#editor.addScene(result.name, result.copy);
      sfx.in();
      this.#editor.switchScene(idx);
    });

    this.#render();
    this.#unsubs.push(
      this.#editor.on('scenes:changed', () => this.#render()),
      this.#editor.on('scene:switched', () => this.#render()),
      this.#editor.on('scene:saved', () => this.#render()),
    );
  }

  destroy() {
    this.#unsubs.forEach(u => u());
    this.#el?.remove();
  }

  #render() {
    const scenes = this.#editor.project.scenes;
    const active = this.#editor.currentSceneIndex;
    const list = this.#listEl;
    if (!list) return;

    list.innerHTML = '';
    scenes.forEach((scene, idx) => {
      const item = document.createElement('div');
      item.className = 'scene-item' + (idx === active ? ' active' : '');

      const thumb = `<img src="${scene.thumbnail ?? getThumbPlaceholder()}" class="scene-thumb" />`;

      item.innerHTML = `
        ${thumb}
        <span class="scene-item-name" title="${this.#esc(scene.name)}">${this.#esc(scene.name)}</span>
        ${scenes.length > 1 ? `<span class="scene-item-del" title="Delete">&#215;</span>` : ''}
      `;
      item.addEventListener('click', async (e) => {
        if (e.target.classList.contains('scene-item-del')) {
          const ok = await showConfirm('Delete Scene', `Delete scene "${scene.name}"?`, 'Delete');
          if (!ok) return;
          sfx.out();
          this.#editor.deleteScene(idx);
          return;
        }
        if (idx !== active) { sfx.in(); this.#editor.switchScene(idx); }
      });
      list.appendChild(item);
    });
  }

  #esc(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
}
