export class TagComponent {
  constructor(name = 'Entity') { this.name = name; }
  serialize() { return { name: this.name }; }
  static deserialize(d) { return new TagComponent(d.name); }
}
