import { TagComponent } from '../components/TagComponent.js';
import { MeshComponent } from '../components/MeshComponent.js';
import { LightComponent } from '../components/LightComponent.js';
import { TriggerComponent } from '../components/TriggerComponent.js';
import { PlayerStartComponent } from '../components/PlayerStartComponent.js';

export class HierarchyPanel {
  #el = null;
  #editor = null;
  #unsubs = [];

  constructor(editor) { this.#editor = editor; }

  mount(parent) {
    this.#el = document.createElement('div');
    this.#el.className = 'panel';
    this.#el.style.cssText = 'flex:1;min-height:0;';
    parent.appendChild(this.#el);
    this.#render();
    this.#unsubs.push(
      this.#editor.on('hierarchy:changed', () => this.#render()),
      this.#editor.on('entity:selected', () => this.#render()),
    );
  }

  destroy() {
    this.#unsubs.forEach(u => u());
    this.#el?.remove();
  }

  #render() {
    const editor = this.#editor;
    const entities = editor.world?.entities ?? [];
    const sel = editor.selectedEntityId;

    this.#el.innerHTML = `
      <div class="panel-header">
        <span>&#128279; Hierarchy</span>
        <div class="panel-header-actions">
          <button class="btn-icon btn" title="Deselect all" id="hier-deselect">&#215;</button>
        </div>
      </div>
      <div class="panel-content" id="hier-content"></div>
    `;

    this.#el.querySelector('#hier-deselect').addEventListener('click', () => editor.selectEntity(null));
    const content = this.#el.querySelector('#hier-content');

    if (entities.length === 0) {
      content.innerHTML = '<div class="hierarchy-empty">No entities in scene</div>';
      return;
    }

    for (const id of entities) {
      const tag = editor.world.getComponent(id, TagComponent);
      const name = tag?.name ?? `Entity ${id}`;
      const icon = this.#getIcon(id);

      const row = document.createElement('div');
      row.className = 'hierarchy-item' + (id === sel ? ' selected' : '');
      row.dataset.entityId = id;
      row.innerHTML = `
        <span class="hierarchy-item-indent"></span>
        <span class="hierarchy-item-icon">${icon}</span>
        <span class="hierarchy-item-name">${this.#esc(name)}</span>
        <span class="hierarchy-item-del" title="Delete">&#215;</span>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.classList.contains('hierarchy-item-del')) return;
        editor.selectEntity(id);
      });

      row.querySelector('.hierarchy-item-name').addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.#startRename(id, e.target);
      });

      row.querySelector('.hierarchy-item-del').addEventListener('click', (e) => {
        e.stopPropagation();
        editor.deleteEntity(id);
      });

      content.appendChild(row);
    }
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
    if (w.hasComponent(entityId, LightComponent)) return '&#128161;';
    if (w.hasComponent(entityId, TriggerComponent)) return '&#128993;';
    if (w.hasComponent(entityId, PlayerStartComponent)) return '&#128694;';
    if (w.hasComponent(entityId, MeshComponent)) return '&#9632;';
    return '&#9711;';
  }

  #esc(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
}
