export class LightComponent {
  constructor(type = 'point', color = 0xffffff, intensity = 1, distance = 10) {
    this.type = type;
    this.color = color;
    this.intensity = intensity;
    this.distance = distance;
  }
  serialize() { return { type: this.type, color: this.color, intensity: this.intensity, distance: this.distance }; }
  static deserialize(d) { return new LightComponent(d.type, d.color, d.intensity, d.distance ?? 10); }
}
