export class FogComponent {
  constructor(color = 0xaaaaaa, near = 10, far = 100) {
    this.color = color;
    this.near = near;
    this.far = far;
  }
  serialize() { return { color: this.color, near: this.near, far: this.far }; }
  static deserialize(d) { return new FogComponent(d.color, d.near, d.far); }
}
