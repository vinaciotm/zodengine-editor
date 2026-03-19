export class ParentComponent {
  constructor(parentId) { this.parentId = parentId; }
  serialize() { return { parentId: this.parentId }; }
  static deserialize(d) { return new ParentComponent(d.parentId); }
}
