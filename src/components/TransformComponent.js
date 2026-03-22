import * as THREE from 'three/webgpu';

export class TransformComponent {
  constructor() {
    this.position = new THREE.Vector3(0, 0, 0);
    this.rotation = new THREE.Euler(0, 0, 0);
    this.scale = new THREE.Vector3(1, 1, 1);
  }
  serialize() {
    return {
      position: this.position.toArray(),
      rotation: [this.rotation.x, this.rotation.y, this.rotation.z, this.rotation.order],
      scale: this.scale.toArray(),
    };
  }
  static deserialize(d) {
    const t = new TransformComponent();
    t.position.fromArray(d.position);
    t.rotation.set(d.rotation[0], d.rotation[1], d.rotation[2], d.rotation[3]);
    t.scale.fromArray(d.scale);
    return t;
  }
}
