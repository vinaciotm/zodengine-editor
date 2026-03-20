export class CommandManager {
  #undoStack = [];
  #redoStack = [];
  #maxHistory = 100;
  #listeners = [];

  push(command) {
    this.#undoStack.push(command);
    if (this.#undoStack.length > this.#maxHistory) this.#undoStack.shift();
    this.#redoStack = [];
    this.#notify();
  }

  undo() {
    const cmd = this.#undoStack.pop();
    if (!cmd) return;
    cmd.undo();
    this.#redoStack.push(cmd);
    this.#notify();
  }

  redo() {
    const cmd = this.#redoStack.pop();
    if (!cmd) return;
    cmd.redo();
    this.#undoStack.push(cmd);
    this.#notify();
  }

  clear() {
    this.#undoStack = [];
    this.#redoStack = [];
    this.#notify();
  }

  get canUndo() { return this.#undoStack.length > 0; }
  get canRedo() { return this.#redoStack.length > 0; }

  onChange(fn) { this.#listeners.push(fn); return () => { this.#listeners = this.#listeners.filter(l => l !== fn); }; }
  #notify() { this.#listeners.forEach(fn => fn()); }
}

// ─── Commands ───────────────────────────────────────────────────────────────

export class SpawnCommand {
  #editor; #entityId; #snapshot;
  constructor(editor, entityId) {
    this.#editor = editor;
    this.#entityId = entityId;
    this.#snapshot = editor.world.snapshotEntity(entityId);
  }
  undo() { this.#editor.deleteEntitySilent(this.#entityId); }
  redo() { this.#editor.restoreEntitySilent(this.#snapshot); }
}

export class DeleteCommand {
  #editor; #snapshot;
  constructor(editor, entityId) {
    this.#editor = editor;
    this.#snapshot = editor.world.snapshotEntity(entityId);
  }
  undo() { this.#editor.restoreEntitySilent(this.#snapshot); }
  redo() { this.#editor.deleteEntitySilent(this.#snapshot.id); }
}

export class RenameCommand {
  #editor; #entityId; #before; #after;
  constructor(editor, entityId, before, after) {
    this.#editor = editor; this.#entityId = entityId;
    this.#before = before; this.#after = after;
  }
  undo() { this.#editor.renameEntitySilent(this.#entityId, this.#before); }
  redo() { this.#editor.renameEntitySilent(this.#entityId, this.#after); }
}

export class TransformCommand {
  #editor; #entityId; #before; #after;
  constructor(editor, entityId, before, after) {
    this.#editor = editor; this.#entityId = entityId;
    this.#before = before; this.#after = after;
  }
  undo() { this.#editor.applyTransformSilent(this.#entityId, this.#before); }
  redo() { this.#editor.applyTransformSilent(this.#entityId, this.#after); }
}

export class DeleteSceneCommand {
  #editor; #scene; #sceneIndex;
  constructor(editor, scene, sceneIndex) {
    this.#editor = editor;
    this.#scene = scene;
    this.#sceneIndex = sceneIndex;
  }
  undo() {
    this.#editor.insertSceneSilent(this.#scene, this.#sceneIndex);
    this.#editor.switchScene(this.#sceneIndex);
  }
  redo() { this.#editor.deleteScene(this.#sceneIndex); }
}

export class AddSceneCommand {
  #editor; #sceneIndex; #scene = null;
  constructor(editor, sceneIndex) {
    this.#editor = editor;
    this.#sceneIndex = sceneIndex;
  }
  undo() {
    const e = this.#editor;
    if (e.project.currentSceneIndex === this.#sceneIndex) e.saveCurrentScene();
    this.#scene = { ...e.project.scenes[this.#sceneIndex] };
    e.deleteScene(this.#sceneIndex);
  }
  redo() {
    const e = this.#editor;
    e.insertSceneSilent(this.#scene, this.#sceneIndex);
    e.switchScene(this.#sceneIndex);
  }
}
