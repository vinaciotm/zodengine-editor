export class MeshComponent {
  constructor(type = 'box', color = 0x4a9eff) {
    this.type = type;
    this.color = color;
  }
  serialize() { return { type: this.type, color: this.color }; }
  static deserialize(d) { return new MeshComponent(d.type, d.color); }
}
