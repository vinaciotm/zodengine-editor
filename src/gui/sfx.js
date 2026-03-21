// ZzFX Sound Engine — ZzFX v2 by Frank Force (MIT)
// https://github.com/KilledByAPixel/ZzFX
let _zzCtx;
function zzfx(
  volume = 1, randomness = .05, frequency = 220,
  attack = 0, sustain = 0, release = .1,
  shape = 0, shapeCurve = 1, slide = 0, deltaSlide = 0,
  pitchJump = 0, pitchJumpTime = 0, repeatTime = 0,
  noise = 0, modulation = 0, bitCrush = 0,
  delay = 0, sustainVolume = 1, decay = 0, tremolo = 0, filter = 0
) {
  const PI2 = Math.PI * 2, SR = 44100;

  volume   = (volume   || 1)   * (.9 + randomness * 2 * Math.random() - .9 * randomness);
  frequency = (frequency || 220) * Math.pow(2, randomness * (Math.random() * 2 - 1) / 12);

  slide      *= PI2 / (SR * 500);
  deltaSlide *= PI2 / (SR * 500);

  const aT  = attack        * SR;
  const dT  = decay         * SR;
  const sT  = sustain       * SR;
  const rT  = release       * SR;
  const dlT = delay         * SR;
  const pjT = pitchJumpTime * SR;

  const total = Math.ceil(aT + dT + sT + rT + dlT + 1);
  const buf   = new Float32Array(total);

  let phase = 0, freq = frequency, slideV = slide, pjDone = false;
  // Low/high-pass filter state
  let fLP = 0, fHP = 0;
  const hasFilter = !!filter;
  const fAbs = Math.abs(filter);
  const fCoef = hasFilter ? Math.exp(-PI2 * fAbs / SR) : 0;

  for (let i = 0; i < total; i++) {
    // Envelope
    let env = 0;
    if      (i < aT)            env = i / aT;
    else if (i < aT + dT)       env = 1 - (1 - sustainVolume) * (i - aT) / dT;
    else if (i < aT + dT + sT)  env = sustainVolume;
    else if (i < aT + dT + sT + rT) env = sustainVolume * (1 - (i - aT - dT - sT) / rT);

    // Tremolo
    if (tremolo) env *= .5 + .5 * Math.sin(PI2 * i * tremolo / SR);

    // Pitch jump
    if (!pjDone && pjT && i >= pjT) { freq += pitchJump; pjDone = true; }

    // Modulation
    const fmod = freq + (modulation ? modulation * Math.sin(PI2 * freq / SR * i) : 0);

    // Waveform
    const p = phase % PI2;
    let s;
    switch (Math.floor(shape)) {
      case 1:  s = Math.abs(p / Math.PI - 1) * 2 - 1; break;            // triangle
      case 2:  s = p / Math.PI - 1;                     break;           // sawtooth
      case 3:  s = p < Math.PI ? 1 : -1;                break;           // square
      case 4:  s = Math.random() * 2 - 1;               break;           // noise
      case 5:  s = Math.max(Math.min(Math.tan(p / 4), 1), -1); break;    // tan/saw
      default: s = Math.sin(p);                          break;           // sine
    }

    // ShapeCurve
    if (shapeCurve !== 1 && s !== 0) s = Math.sign(s) * Math.pow(Math.abs(s), shapeCurve);

    // Noise mix
    if (noise) s = s * (1 - noise) + (Math.random() * 2 - 1) * noise;

    // Bit crush
    if (bitCrush) { const step = Math.pow(2, 1 - bitCrush * 16); s = Math.round(s / step) * step; }

    // Filter (simple LP / HP)
    if (hasFilter) {
      if (filter > 0) { fLP = fCoef * fLP + (1 - fCoef) * s; s = fLP; }
      else            { fHP = fCoef * fHP + s; s = s - fHP; }
    }

    buf[i] = Math.max(-1, Math.min(1, s * env * volume));

    phase  += PI2 * fmod / SR + slideV;
    slideV += deltaSlide;
  }

  if (!_zzCtx) _zzCtx = new AudioContext();
  _zzCtx.resume();
  const ab  = _zzCtx.createBuffer(1, buf.length, SR);
  ab.getChannelData(0).set(buf);
  const src = _zzCtx.createBufferSource();
  src.buffer = ab;
  src.connect(_zzCtx.destination);
  src.start(_zzCtx.currentTime);
}

export const sfx = {
  // open / create / expand / select
  in() {
    zzfx(.12, .05, 340, 0, 0, .07, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0);
  },

  // close / exit / delete
  out() {
    zzfx(.10, .05, 300, 0, 0, .09, 0, 1, -6, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0);
  },

  // open project — thunder
  suck() {
    zzfx(1.1,.05,75,.23,.09,.39,0,3.7,0,0,167,0,0,.1,0,.1,0,.57,.02,.01,0); // Random 146
  },

  // theme change / create project / create scene — bright double ding
  check() {
    zzfx(.18, .05, 880, 0, 0, .05, 0, 1, 0, 0, 440, .05, 0, 0, 0, 0, 0, 1, 0, 0, 0);
    setTimeout(() => zzfx(.14, .05, 1320, 0, 0, .04, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0), 55);
  },

  // hotkey 1–6 — short click
  click() {
    zzfx(.06, .05, 680, 0, 0, .022, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0);
  },

  // logo click — cash register grave
  win() {
    zzfx(.32, .03, 145, 0, .01, .07, 1, 1.2, 5, 0, 0, 0, 0, 0, 0, 0, 0, .8, .01);
    setTimeout(() => zzfx(.26, .03, 118, 0, .01, .05, 1, 1.2, 7, 0, 0, 0, 0, 0, 0, 0, 0, .72, .01), 48);
    setTimeout(() => zzfx(.2, .03, 195, .005, .04, .12, 0, 1.3, 0, 0, 55, .04, 0, 0, 0, 0, 0, .88, .02), 115);
  },

  // exit project — falling grave
  drop() {
    zzfx(1.1,.05,75,.23,.09,.39,0,3.7,0,0,167,0,0,.1,0,.1,0,.57,.02,.01,0); // Random 146
  },

  // create object in scene — Shoot 1
  spawn() {
    zzfx(...[, , 50, .01, .04, .06, 1, , 6, -32, , , , , , , , .99, .06]);
  },

  // save — Random 32
  save() {
    zzfx(...[, , 23, .12, .03, .05, 4, 2.6, -6, , , , , .7, , , , .5, .03]);
  },
};
