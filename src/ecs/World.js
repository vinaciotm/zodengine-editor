export class World {
  #nextEntityId = 1;
  #entities = new Set();
  #components = new Map();
  #systems = [];

  createEntity() {
    const id = this.#nextEntityId++;
    this.#entities.add(id);
    this.#components.set(id, new Map());
    return id;
  }

  destroyEntity(id) {
    this.#entities.delete(id);
    this.#components.delete(id);
  }

  addComponent(entityId, component) {
    this.#components.get(entityId)?.set(component.constructor, component);
    return this;
  }

  getComponent(entityId, ComponentClass) {
    return this.#components.get(entityId)?.get(ComponentClass);
  }

  hasComponent(entityId, ComponentClass) {
    return this.#components.get(entityId)?.has(ComponentClass) ?? false;
  }

  removeComponent(entityId, ComponentClass) {
    this.#components.get(entityId)?.delete(ComponentClass);
  }

  query(...ComponentClasses) {
    const result = [];
    for (const id of this.#entities) {
      if (ComponentClasses.every(C => this.hasComponent(id, C))) result.push(id);
    }
    return result;
  }

  addSystem(system) {
    this.#systems.push(system);
    system.world = this;
    system.init?.();
    return this;
  }

  update(delta) {
    for (const system of this.#systems) system.update?.(delta);
  }

  get entities() { return [...this.#entities]; }

  clear() {
    for (const id of [...this.#entities]) this.destroyEntity(id);
    this.#nextEntityId = 1;
  }

  snapshot() {
    const data = { nextId: this.#nextEntityId, entities: [] };
    for (const id of this.#entities) {
      const comps = {};
      for (const [Class, comp] of this.#components.get(id)) {
        if (comp.serialize) comps[Class.name] = comp.serialize();
      }
      data.entities.push({ id, components: comps });
    }
    return data;
  }

  restore(data, componentRegistry) {
    this.clear();
    this.#nextEntityId = data.nextId;
    for (const { id, components } of data.entities) {
      this.#entities.add(id);
      this.#components.set(id, new Map());
      for (const [name, compData] of Object.entries(components)) {
        const Class = componentRegistry[name];
        if (Class) this.#components.get(id).set(Class, Class.deserialize(compData));
      }
    }
  }
}
