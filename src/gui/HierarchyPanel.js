import { makeCollapsiblePanel, showConfirm } from './utils.js';
import { sfx } from './sfx.js';
import { TagComponent } from '../components/TagComponent.js';
import { MeshComponent } from '../components/MeshComponent.js';
import { LightComponent } from '../components/LightComponent.js';
import { TriggerComponent } from '../components/TriggerComponent.js';
import { PlayerStartComponent } from '../components/PlayerStartComponent.js';
import { GroupComponent } from '../components/GroupComponent.js';
import { ParentComponent } from '../components/ParentComponent.js';
import { CameraComponent } from '../components/CameraComponent.js';
import { FogComponent } from '../components/FogComponent.js';
import { SkyBoxComponent } from '../components/SkyBoxComponent.js';
import { getEntityIconType, iconURL } from './entityIcons.js';

export class HierarchyPanel {
  #el = null;
  #editor = null;
  #unsubs = [];
  #contentEl = null;
  #collapsedGroups = new Set();

  constructor(editor) { this.#editor = editor; }

  mount(parent) {
    this.#el = document.createElement('div');
    this.#el.className = 'panel';
    this.#el.style.cssText = 'flex:1;min-height:0;';
    parent.appendChild(this.#el);

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `<span class="ph-icon">&#128279;</span><span class="ph-text"> Objetos</span>`;
    this.#el.appendChild(header);

    this.#contentEl = document.createElement('div');
    this.#contentEl.className = 'panel-content';
    this.#contentEl.id = 'hier-content';
    this.#el.appendChild(this.#contentEl);

    makeCollapsiblePanel(header, this.#contentEl, true, open => open ? sfx.in() : sfx.out());

    this.#render();
    this.#unsubs.push(
      this.#editor.on('hierarchy:changed', () => this.#render()),
      this.#editor.on('entity:selected', () => this.#updateSelection()),
      this.#editor.on('selection:changed', () => this.#updateSelection()),
    );
  }

  destroy() {
    this.#unsubs.forEach(u => u());
    this.#el?.remove();
  }

  #updateSelection() {
    const sel = this.#editor.selectedEntityId;
    const selIds = this.#editor.selectedEntityIds;
    if (!this.#contentEl) return;
    const selStr = sel !== null ? String(sel) : null;
    this.#contentEl.querySelectorAll('.hierarchy-item').forEach(row => {
      const id = row.dataset.entityId;
      const isSelected = (selStr !== null && selStr === id) || [...selIds].some(s => String(s) === id);
      row.classList.toggle('selected', isSelected);
    });
  }

  #render() {
    const editor = this.#editor;
    const entities = editor.world?.entities ?? [];
    const sel = editor.selectedEntityId;
    const selIds = editor.selectedEntityIds;
    const content = this.#contentEl;
    if (!content) return;

    content.innerHTML = '';

    if (entities.length === 0) {
      content.innerHTML = '<div class="hierarchy-empty">No entities in scene</div>';
      return;
    }

    const roots = entities.filter(id => !editor.world.hasComponent(id, ParentComponent));
    roots.sort((a, b) => {
      const aG = editor.world.hasComponent(a, GroupComponent) ? 0 : 1;
      const bG = editor.world.hasComponent(b, GroupComponent) ? 0 : 1;
      return aG - bG;
    });

    const renderEntity = (id, depth = 0) => {
      const tag = editor.world.getComponent(id, TagComponent);
      const name = tag?.name ?? `Entity ${id}`;
      const icon = this.#getIcon(id);
      const isSelected = (sel !== null && String(sel) === String(id)) || [...selIds].some(s => String(s) === String(id));
      const isGroup = editor.world.hasComponent(id, GroupComponent);
      const isCollapsed = isGroup && this.#collapsedGroups.has(id);

      const isVisible = editor.isEntityVisible(id);
      const row = document.createElement('div');
      row.className = 'hierarchy-item' + (isSelected ? ' selected' : '') + (isVisible ? '' : ' entity-hidden');
      row.dataset.entityId = id;

      const indentEl = document.createElement('span');
      indentEl.className = 'hierarchy-item-indent';
      indentEl.style.width = (depth * 16) + 'px';

      const collapseEl = document.createElement('span');
      collapseEl.className = 'hierarchy-collapse-btn';
      if (isGroup) {
        collapseEl.textContent = isCollapsed ? '▶' : '▼';
        collapseEl.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.#collapsedGroups.has(id)) this.#collapsedGroups.delete(id);
          else this.#collapsedGroups.add(id);
          this.#render();
        });
      }

      const iconEl = document.createElement('span');
      iconEl.className = 'hierarchy-item-icon';
      iconEl.innerHTML = icon;

      const nameEl = document.createElement('span');
      nameEl.className = 'hierarchy-item-name';
      nameEl.textContent = name;

      const actionsEl = document.createElement('span');
      actionsEl.style.cssText = 'display:flex;gap:2px;flex-shrink:0;';

      if (isGroup) {
        const ungroupBtn = document.createElement('span');
        ungroupBtn.className = 'hierarchy-item-del';
        ungroupBtn.title = 'Ungroup';
        ungroupBtn.innerHTML = '&#127968;';
        ungroupBtn.style.opacity = '0';
        ungroupBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          editor.ungroupEntity(id);
        });
        actionsEl.appendChild(ungroupBtn);
        row.addEventListener('mouseover', () => { ungroupBtn.style.opacity = '1'; });
        row.addEventListener('mouseleave', () => { ungroupBtn.style.opacity = '0'; });
      }

      const eyeBtn = document.createElement('span');
      eyeBtn.className = 'hierarchy-item-eye' + (isVisible ? '' : ' hidden');
      eyeBtn.title = isVisible ? 'Hide' : 'Show';
      eyeBtn.innerHTML = '&#128065;';
      eyeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editor.toggleEntityVisibility(id);
      });
      actionsEl.appendChild(eyeBtn);

      const delBtn = document.createElement('span');
      delBtn.className = 'hierarchy-item-del';
      delBtn.title = 'Delete';
      delBtn.innerHTML = '&#215;';
      actionsEl.appendChild(delBtn);

      row.appendChild(indentEl);
      row.appendChild(collapseEl);
      row.appendChild(iconEl);
      row.appendChild(nameEl);
      row.appendChild(actionsEl);

      row.addEventListener('click', (e) => {
        if (e.target.classList.contains('hierarchy-item-del') || e.target.closest('.hierarchy-item-del')) return;
        if (e.shiftKey) {
          const newSet = new Set(editor.selectedEntityIds);
          if (newSet.has(id)) newSet.delete(id);
          else newSet.add(id);
          editor.selectedEntityIds.clear();
          for (const sid of newSet) editor.selectedEntityIds.add(sid);
          editor.selectedEntityId = [...editor.selectedEntityIds].at(-1) ?? null;
          if (editor.selectedEntityId) {
            const obj = editor.renderSystem.getObject3D(editor.selectedEntityId);
            if (obj) editor.transformControls.attach(obj);
          } else {
            editor.transformControls.detach();
          }
          editor.emit('entity:selected', editor.selectedEntityId);
          editor.emit('selection:changed', editor.selectedEntityIds, editor.selectedEntityId);
        } else {
          editor.selectEntity(id);
        }
      });

      nameEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.#startRename(id, nameEl);
      });

      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const entityName = editor.world.getComponent(id, TagComponent)?.name ?? 'Entity';
        showConfirm('Delete Entity', `Delete "${entityName}"?`, 'Delete').then(ok => {
          if (ok) { sfx.save(); editor.deleteEntity(id); }
        });
      });

      content.appendChild(row);

      if (isGroup && !isCollapsed) {
        const children = entities.filter(cid => {
          const p = editor.world.getComponent(cid, ParentComponent);
          return p?.parentId === id;
        });
        for (const cid of children) renderEntity(cid, depth + 1);
      }
    };

    for (const id of roots) renderEntity(id, 0);
  }

  #startRename(entityId, nameEl) {
    const current = nameEl.textContent;
    const input = document.createElement('input');
    input.className = 'hierarchy-item-name-input';
    input.value = current;
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    const finish = () => {
      const newName = input.value.trim() || current;
      this.#editor.renameEntity(entityId, newName);
    };
    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = current; input.blur(); }
    });
  }

  #getIcon(entityId) {
    const w = this.#editor.world;
    if (w.hasComponent(entityId, GroupComponent)) return '&#128193;';
    if (w.hasComponent(entityId, TriggerComponent)) return '&#128993;';
    if (w.hasComponent(entityId, PlayerStartComponent)) return '&#128694;';
    const type = getEntityIconType(entityId, w);
    if (type) return `<img src="${iconURL(type)}" width="14" height="14" style="vertical-align:middle;display:inline-block;">`;
    return '&#9711;';
  }
}
