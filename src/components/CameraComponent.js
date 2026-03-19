export class CameraComponent {
  fov = 60;
  near = 0.1;
  far = 1000;

  serialize() {
    return { fov: this.fov, near: this.near, far: this.far };
  }

  static deserialize(d) {
    const c = new CameraComponent();
    c.fov = d.fov ?? 60;
    c.near = d.near ?? 0.1;
    c.far = d.far ?? 1000;
    return c;
  }
}
