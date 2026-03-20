export class MeshComponent {
  constructor(type = 'box', color = 0x4a9eff) {
    this.type = type;
    this.color = color;
    this.materialType = 'standard';
    this.roughness = 0.5;
    this.metalness = 0;
    this.shininess = 30;
    this.opacity = 1;
    this.wireframe = false;
  }

  serialize() {
    return {
      type: this.type,
      color: this.color,
      materialType: this.materialType,
      roughness: this.roughness,
      metalness: this.metalness,
      shininess: this.shininess,
      opacity: this.opacity,
      wireframe: this.wireframe,
    };
  }

  static deserialize(d) {
    const c = new MeshComponent(d.type, d.color);
    c.materialType = d.materialType ?? 'standard';
    c.roughness    = d.roughness    ?? 0.5;
    c.metalness    = d.metalness    ?? 0;
    c.shininess    = d.shininess    ?? 30;
    c.opacity      = d.opacity      ?? 1;
    c.wireframe    = d.wireframe    ?? false;
    return c;
  }
}
