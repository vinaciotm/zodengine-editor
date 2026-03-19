export class TriggerComponent {
  constructor(type = 'box', size = 1) {
    this.type = type;
    this.size = size;
  }
  serialize() { return { type: this.type, size: this.size }; }
  static deserialize(d) { return new TriggerComponent(d.type, d.size); }
}
