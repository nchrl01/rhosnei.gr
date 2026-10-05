// Equations and names transcribed from the supplied @the.lab67 function reel.
// The displayed source domain is represented by x = 16p - 8. Amplitude gates
// are bounded performance adaptations; the plotted primary equations stay raw.
// The reel labels c_s as a cowbell sequence but never defines its notes. The
// auxiliary voices below use an authored, deterministic 32-step sequence.

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const mod = (value, period) => ((value % period) + period) % period;
const upperX = 8 - 1e-9;
const domain = value => clamp(Number.isFinite(Number(value)) ? Number(value) : 0, -8, upperX);
const phaseX = phase => -8 + 16 * clamp(Number(phase) || 0, 0, 1 - 1e-9);
const unitPhase = x => (domain(x) + 8) / 16;
const funkNotes = [0, 0, 3, -2];
const bassNotes = [0, 0, -4, -2];
const wobbleRates = [1, 2, 1, 3, 1, 2, 3, 3];
const melodyIndex = x => mod(Math.floor((domain(x) + 8) / 4), 4);

function funkDistance(x) {
  const beat = mod(domain(x) + 8, 8);
  return beat - (beat >= 6 ? 6 : beat >= 3 ? 3 : 0);
}

function bounceHeight(x) {
  const r = .65;
  const s = mod(domain(x) + 8, 4);
  const n = Math.floor(Math.log(Math.max(Number.EPSILON, 1 - s / 4)) / Math.log(r));
  const scale = r ** n;
  const v = clamp((s - 4 * (1 - scale)) / (4 * (1 - r) * scale));
  return 3.6 * scale * scale * 4 * v * (1 - v);
}

function hash(value) {
  value = Math.imul((value >>> 0) ^ 0x9e3779b9, 0x85ebca6b);
  value ^= value >>> 13;
  return Math.imul(value, 0xc2b2ae35) >>> 0;
}

function cowbell(x, seed = 0) {
  const position = domain(x) * 4;
  const step = mod(Math.floor(position), 32);
  const within = mod(position, 1);
  // This minor-pentatonic note bank is authored here, not supplied by the reel.
  const notes = [0, 0, 3, 5, 7, 10, 12, 7];
  const note = notes[hash((Number(seed) >>> 0) ^ Math.imul(step + 1, 0x45d9f3b)) % notes.length];
  return [2 + note / 12, within < .65 ? Math.exp(-7 * within) * .32 : 0];
}

const definitions = [
  {
    id: 'funk', name: 'BRAZILIAN FUNK', base: 32, shape: .6, drive: 1.5,
    formula: 'y = 4.2e⁻¹⁶ᵈ − 1.7 + mₖ/12; d = beats since the last hit (3 + 3 + 2); k = ⌊(x + 8)/4⌋ mod 4; m = (0, 0, 3, −2)',
    graph(x) { x = domain(x); return 4.2 * Math.exp(-16 * funkDistance(x)) - 1.7 + funkNotes[melodyIndex(x)] / 12; },
    gate(x) { return Math.exp(-5 * funkDistance(x)); },
    breakAt(x, previousX) {
      if (!Number.isFinite(previousX)) return true;
      return funkDistance(x) < funkDistance(previousX);
    },
  },
  {
    id: 'fourier', name: 'FOURIER SERIES', base: 43, shape: .2, drive: 1,
    formula: 'y = 1 + (4/π) Σₖ₌₀ᴺ⁻¹ sin(2π(2k + 1)x)/(2k + 1); N = 2^⌊(x + 8)/4⌋ = 1, 2, 4, 8 → square wave',
    graph(x) {
      x = domain(x);
      const count = 2 ** clamp(Math.floor((x + 8) / 4), 0, 3);
      let total = 0;
      for (let k = 0; k < count; k++) total += Math.sin(2 * Math.PI * (2 * k + 1) * x) / (2 * k + 1);
      return 1 + 4 / Math.PI * total;
    },
    gate(x) { return .5 * Math.sin(Math.PI * unitPhase(x)); },
  },
  {
    id: 'phonk', name: 'DRIFT PHONK', base: 34, shape: .85, drive: 1.8,
    formula: 'y₁ = −1.6 + mₖ/12 + 3.6e^(−14(x mod 2)); y₂ = 2 + cₛ/12 (cowbell); m = (0, 0, −4, −2); s = ⌊4x⌋ mod 32',
    graph(x) { x = domain(x); return -1.6 + bassNotes[melodyIndex(x)] / 12 + 3.6 * Math.exp(-14 * mod(x, 2)); },
    gate(x) { return Math.exp(-5 * mod(domain(x), 2)); },
    breakAt(x, previousX) { return !Number.isFinite(previousX) || Math.floor(domain(x) / 2) !== Math.floor(domain(previousX) / 2); },
    aux: cowbell,
    auxiliaryProvenance: 'The source shows y₂ = 2 + cₛ/12 but does not define cₛ; its 32-step note sequence here is a seeded adaptation. k follows the definition introduced in Brazilian Funk.',
  },
  {
    id: 'tangent', name: 'THE TANGENT', base: 41, shape: .3, drive: 1,
    formula: 'y = ½tan(πx) + ¾ + ¼(⌊x/4⌋ mod 2); silent near the asymptotes',
    graph(x) {
      x = domain(x);
      if (Math.abs(Math.cos(Math.PI * x)) < 1e-9) return NaN;
      return .5 * Math.tan(Math.PI * x) + .75 + .25 * mod(Math.floor(x / 4), 2);
    },
    gate(x) { return Math.abs(Math.cos(Math.PI * domain(x))) > .24 ? .4 : 0; },
    breakAt(x, previousX) {
      return !Number.isFinite(previousX) || Math.floor(domain(x) + .5) !== Math.floor(domain(previousX) + .5)
        || Math.floor(domain(x) / 4) !== Math.floor(domain(previousX) / 4);
    },
  },
  {
    id: 'kick', name: 'HARDSTYLE KICK', base: 27, shape: .9, drive: 2.2,
    formula: 'y = 5e⁻¹⁴ʳ − 1 − r/2 if r < 0.55; y = −1.9 + 1.6w² otherwise; r = x mod 1; w = (r − 0.55)/0.45 (reverse bass)',
    graphRange: [-2.5, 4.1],
    graph(x) { const r = mod(domain(x), 1), w = (r - .55) / .45; return r < .55 ? 5 * Math.exp(-14 * r) - 1 - r / 2 : -1.9 + 1.6 * w * w; },
    gate(x) { const r = mod(domain(x), 1), w = (r - .55) / .45; return r < .55 ? Math.exp(-8 * r) : .2 * w * w; },
    breakAt(x, previousX) {
      if (!Number.isFinite(previousX)) return true;
      x = domain(x); previousX = domain(previousX);
      return Math.floor(x) !== Math.floor(previousX) || (mod(x, 1) < .55) !== (mod(previousX, 1) < .55);
    },
  },
  {
    id: 'bounce', name: 'BOUNCING BALL', base: 38, shape: .15, drive: 1,
    formula: 'y = 3.6r²ⁿ · 4v(1 − v) − 0.8; r = 0.65; n = ⌊logᵣ(1 − s/4)⌋; s = (x + 8) mod 4; v = (s − 4(1 − rⁿ))/(4(1 − r)rⁿ); infinitely many bounces',
    graph(x) { return bounceHeight(x) - .8; },
    gate(x) { return clamp(bounceHeight(x) / 2.5); },
  },
  {
    id: 'wobble', name: 'DUBSTEP WOBBLE', base: 32, shape: .7, drive: 1.4,
    formula: 'y = −1.2 + 1.3sin(2πrₖ(x mod 1)); k = ⌊x⌋ mod 8; r = (1, 2, 1, 3, 1, 2, 3, 3)',
    graph(x) { x = domain(x); return -1.2 + 1.3 * Math.sin(2 * Math.PI * wobbleRates[mod(Math.floor(x), 8)] * mod(x, 1)); },
    gate() { return .42; },
  },
  {
    id: 'heart', name: 'THE HEART FUNCTION', base: 41, shape: .1, drive: 1,
    graphRange: [-2.8, 2.8],
    formula: 'y = 1.25(|u|²ᐟ³ + 0.9√(3.3 − u²)sin(17.6πu)) − 0.6; u = x/4.4',
    graph(x) {
      const u = domain(x) / 4.4, square = 3.3 - u * u;
      // The literal source is undefined in the tiny edge intervals where the
      // square root is negative. A gap preserves that domain in the graph.
      if (square < 0) return NaN;
      return 1.25 * (Math.abs(u) ** (2 / 3) + .9 * Math.sqrt(square) * Math.sin(17.6 * Math.PI * u)) - .6;
    },
    gate(x) { return .38 * Math.sin(Math.PI * unitPhase(x)); },
  },
  {
    id: 'build', name: 'THE BUILD-UP', base: 40, shape: .35, drive: 1,
    formula: 'y = (x + 8)/8 − 1.2 + A sin(π(x + 8)²/2); A = 0.4 + 0.08(x + 8)',
    graph(x) { const shifted = domain(x) + 8; return shifted / 8 - 1.2 + (.4 + .08 * shifted) * Math.sin(Math.PI * shifted * shifted / 2); },
    gate(x) { return .15 + .4 * unitPhase(x); },
  },
  {
    id: 'drop', name: 'THE DROP', base: 31, shape: .75, drive: 1.7,
    formula: 'y₁ = 4.7e^(−12(x mod 1)) − 1.9 + mₖ/12; y₂ = 2 + cₛ/12 (cowbell); m = (0, 0, −4, −2)',
    graph(x) { x = domain(x); return 4.7 * Math.exp(-12 * mod(x, 1)) - 1.9 + bassNotes[melodyIndex(x)] / 12; },
    gate(x) { return Math.exp(-5 * mod(domain(x), 1)); },
    breakAt(x, previousX) { return !Number.isFinite(previousX) || Math.floor(domain(x)) !== Math.floor(domain(previousX)); },
    aux: cowbell,
    auxiliaryProvenance: 'The source shows y₂ = 2 + cₛ/12 but does not define cₛ; its 32-step note sequence here is a seeded adaptation. k and s use the definitions introduced earlier in the reel.',
  },
];

export const REEL_FUNCTIONS = definitions.map(definition => ({
  source: 'lab67',
  graphSpan: [-8, 8],
  graphRange: [-2.5, 3],
  ...definition,
  sample(phase) {
    const x = phaseX(phase);
    const raw = definition.graph(x);
    // A mathematical domain gap or exact pole is silent, never sent as NaN.
    return Number.isFinite(raw) ? [raw, clamp(definition.gate(x))] : [0, 0];
  },
}));
