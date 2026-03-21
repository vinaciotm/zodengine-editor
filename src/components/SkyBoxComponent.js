export class SkyBoxComponent {
  constructor(
    turbidity = 0.5,
    rayleigh = 0.4,
    mieCoefficient = 0.2,
    mieDirectionalG = 0.3,
    elevation = 9,
    azimuth = 160,
    exposure = 1,
    cloudCoverage = 0.4,
    cloudDensity = 0.4,
    cloudElevation = 1,
  ) {
    this.turbidity = turbidity;
    this.rayleigh = rayleigh;
    this.mieCoefficient = mieCoefficient;
    this.mieDirectionalG = mieDirectionalG;
    this.elevation = elevation;
    this.azimuth = azimuth;
    this.exposure = exposure;
    this.cloudCoverage = cloudCoverage;
    this.cloudDensity = cloudDensity;
    this.cloudElevation = cloudElevation;
  }

  serialize() {
    return {
      turbidity: this.turbidity,
      rayleigh: this.rayleigh,
      mieCoefficient: this.mieCoefficient,
      mieDirectionalG: this.mieDirectionalG,
      elevation: this.elevation,
      azimuth: this.azimuth,
      exposure: this.exposure,
      cloudCoverage: this.cloudCoverage,
      cloudDensity: this.cloudDensity,
      cloudElevation: this.cloudElevation,
    };
  }

  static deserialize(d) {
    return new SkyBoxComponent(
      d.turbidity, d.rayleigh, d.mieCoefficient, d.mieDirectionalG,
      d.elevation, d.azimuth, d.exposure,
      d.cloudCoverage, d.cloudDensity, d.cloudElevation,
    );
  }
}
