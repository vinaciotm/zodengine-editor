export class LightComponent {
  constructor(type = 'point', color = 0xffffff, intensity = 1) {
    this.type = type;
    this.color = color;
    this.intensity = intensity;
  }
  serialize() { return { type: this.type, color: this.color, intensity: this.intensity }; }
  static deserialize(d) { return new LightComponent(d.type, d.color, d.intensity); }
}
