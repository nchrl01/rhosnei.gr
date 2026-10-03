// Transcribed from the first supplied @indent126 reel (approximately 65 s).
// It displays equations without titles. These names describe the expressions;
// they are not presented as titles supplied by the video's author.
// `graph` evaluates the displayed equation without display/audio clipping.
// The symmetric domains reproduce the visible period counts in that reel.
const mod = (x, period = 1) => x - period * Math.floor(x / period);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const triangle = x => 4 * Math.abs(x - Math.floor(x + 3 / 4) + 1 / 4) - 1;
const floorChanged = fn => (a, b) => fn(a) !== fn(b);
const exponentialStep = x => Math.floor((Math.floor(x) + 1) * 5 / 16);
const reciprocal = x => 10 / (1 + 9 * mod(x / 5));
const warpedRamp = x => x / 3 + .6 * Math.sin(x);

function reference({ index, graphSpan, graphRange, breakBetween = () => false,
  gate = () => .42, base = 48, shape = .2, drive = 1, ...definition }) {
  const [xMin, xMax] = graphSpan;
  const [yMin, yMax] = graphRange;
  const pattern = {
    ...definition, graphSpan, graphRange, breakBetween, base, shape, drive,
    domain: { xMin, xMax, yMin, yMax },
    source: 'first-video', sourceIndex: index,
    sourceTime: [(index - 1) * 5, index === 13 ? 65.27 : index * 5],
    sourceTimeApproximate: true, nameSource: 'descriptive',
  };
  pattern.sample = phase => {
    const p = clamp(Number.isFinite(phase) ? phase : 0, 0, 1);
    const x = xMin + p * (xMax - xMin);
    const y = pattern.graph(x);
    if (!Number.isFinite(y)) return [0, 0];
    // Brief silence around a jump keeps the audio from crossing the missing
    // part of the graph. Raw y remains unchanged for the caller's pitch map.
    const margin = (xMax - xMin) * .00065;
    const discontinuous = breakBetween(x - margin, x + margin);
    return [y, discontinuous ? 0 : clamp(gate(x, y), 0, 1)];
  };
  return pattern;
}

export const REFERENCE_FUNCTIONS = [
  reference({
    index: 1, id: 'reference-triangle-sum', name: 'Triangle sum', kind: 'tonal',
    formula: 'y = 4|x − ⌊x + ¾⌋ + ¼| − 1 + (4|2x − ⌊2x + ¾⌋ + ¼| − 1)/2 + (4|4x − ⌊4x + ¾⌋ + ¼| − 1)/4 + (4|8x − ⌊8x + ¾⌋ + ¼| − 1)/8',
    graph: x => triangle(x) + triangle(2 * x) / 2 + triangle(4 * x) / 4 + triangle(8 * x) / 8,
    graphSpan: [-2, 2], graphRange: [-1.4, 1.4], shape: .38,
  }),
  reference({
    index: 2, id: 'reference-nested-triangles', name: 'Nested triangle modulation', kind: 'tonal',
    formula: 'y = 1.6(4|x/2 − ⌊x/2 + ¾⌋ + ¼| − 1 + (0.42 + 0.3sin(πx/6))(4|x − ⌊x + ¾⌋ + ¼| − 1 + (0.42 + 0.3sin(πx/6))(4|2x − ⌊2x + ¾⌋ + ¼| − 1 + (0.42 + 0.3sin(πx/6))(4|4x − ⌊4x + ¾⌋ + ¼| − 1 + (0.42 + 0.3sin(πx/6))(4|8x − ⌊8x + ¾⌋ + ¼| − 1)))))',
    graph: x => {
      const a = .42 + .3 * Math.sin(Math.PI * x / 6);
      return 1.6 * (triangle(x / 2) + a * (triangle(x) + a * (triangle(2 * x) + a * (triangle(4 * x) + a * triangle(8 * x)))));
    },
    graphSpan: [-12, 12], graphRange: [-2.8, 2.8], shape: .3,
  }),
  reference({
    index: 3, id: 'reference-stepped-exponential', name: 'Stepped exponential', kind: 'rhythm',
    formula: 'y = −2.46 + 1.23(2⌊((⌊x⌋ + 1)·5)/16⌋ mod 3) + 2.46exp(−1.2(x − ⌈16⌊((⌊x⌋ + 1)·5)/16⌋/5⌉ + 1))',
    graph: x => {
      const k = exponentialStep(x);
      return -2.46 + 1.23 * mod(2 * k, 3) + 2.46 * Math.exp(-1.2 * (x - Math.ceil(16 * k / 5) + 1));
    },
    graphSpan: [-23, 23], graphRange: [-2.9, 2.9],
    breakBetween: floorChanged(exponentialStep), shape: .65, drive: 1.3,
  }),
  reference({
    index: 4, id: 'reference-alternating-sine', name: 'Alternating sine segments', kind: 'rhythm',
    formula: 'y = (1 − 2⌊2(x mod 1)⌋)|sin(πx/4)|x + |x| − 10',
    graph: x => (1 - 2 * Math.floor(2 * mod(x))) * Math.abs(Math.sin(Math.PI * x / 4)) * x + Math.abs(x) - 10,
    graphSpan: [-12, 12], graphRange: [-11, 11],
    breakBetween: floorChanged(x => Math.floor(2 * x)), shape: .2,
  }),
  reference({
    index: 5, id: 'reference-quadratic-sine', name: 'Quadratic sine segments', kind: 'rhythm',
    // The apparently redundant floor(x) mod 1 is visible in the source.
    formula: 'y = (1 − 2⌊(x mod 4)/2⌋)sin(5|⌊x⌋ mod 1 − (x mod 1)|²)',
    graph: x => (1 - 2 * Math.floor(mod(x, 4) / 2)) * Math.sin(5 * Math.abs(mod(Math.floor(x)) - mod(x)) ** 2),
    graphSpan: [-4, 4], graphRange: [-1.25, 1.25],
    breakBetween: floorChanged(Math.floor), shape: .32,
  }),
  reference({
    index: 6, id: 'reference-reciprocal-modulo', name: 'Reciprocal modulo', kind: 'rhythm',
    formula: 'y = (1 + 3.89/(1 + 9((x/5) mod 1)))(10/(1 + 9((x/5) mod 1)) mod 1) − 2.5',
    graph: x => (1 + 3.89 / (1 + 9 * mod(x / 5))) * mod(reciprocal(x)) - 2.5,
    graphSpan: [-10, 10], graphRange: [-3.5, 3.5],
    breakBetween: (a, b) => Math.floor(a / 5) !== Math.floor(b / 5) || Math.floor(reciprocal(a)) !== Math.floor(reciprocal(b)),
    shape: .8, drive: 1.4,
  }),
  reference({
    index: 7, id: 'reference-exponential-modulo', name: 'Exponential modulo', kind: 'rhythm',
    formula: 'y = 5.2(exp(0.25x) mod 1) − 2.6',
    graph: x => 5.2 * mod(Math.exp(.25 * x)) - 2.6,
    graphSpan: [-13, 13], graphRange: [-2.6, 2.6],
    breakBetween: floorChanged(x => Math.floor(Math.exp(.25 * x))),
    shape: .7, drive: 1.25,
  }),
  reference({
    index: 8, id: 'reference-warped-sawtooth', name: 'Sine-warped sawtooth', kind: 'tonal',
    formula: 'y = 2.9·2(x/3 + 0.6sin(x) − ⌊x/3 + 0.6sin(x) + ½⌋)',
    graph: x => 2.9 * 2 * (warpedRamp(x) - Math.floor(warpedRamp(x) + .5)),
    graphSpan: [-14, 14], graphRange: [-2.9, 2.9],
    breakBetween: floorChanged(x => Math.floor(warpedRamp(x) + .5)),
    shape: .4,
  }),
  reference({
    index: 9, id: 'reference-sine-over-cosh', name: 'Squared sine over cosh', kind: 'tonal',
    formula: 'y = sin²(6.5x)/cosh(x/2.6)',
    graph: x => Math.sin(6.5 * x) ** 2 / Math.cosh(x / 2.6),
    graphSpan: [-12, 12], graphRange: [-1.5, 1.5],
    gate: (x, y) => .12 + .32 * Math.sqrt(Math.max(0, y)), shape: .15,
  }),
  reference({
    index: 10, id: 'reference-modulo-difference', name: 'Modulo difference', kind: 'tonal',
    formula: 'y = (x/3) mod 1 − ((x/7) mod 1)',
    graph: x => mod(x / 3) - mod(x / 7),
    graphSpan: [-21, 21], graphRange: [-1.1, 1.1],
    breakBetween: (a, b) => Math.floor(a / 3) !== Math.floor(b / 3) || Math.floor(a / 7) !== Math.floor(b / 7),
    shape: .35,
  }),
  reference({
    index: 11, id: 'reference-sine-ratio', name: 'Sine ratio', kind: 'tonal',
    formula: 'y = 1.2sin(x)/sin(1.08x)',
    graph: x => {
      const denominator = Math.sin(1.08 * x);
      // This includes the removable hole at x = 0; no invented value is
      // substituted into the original quotient. Its nearby limit is finite.
      return Math.abs(denominator) < 1e-12 ? NaN : 1.2 * Math.sin(x) / denominator;
    },
    graphSpan: [-40, 40], graphRange: [-7, 7],
    breakBetween: floorChanged(x => Math.floor(1.08 * x / Math.PI)),
    gate: (x, y) => Math.abs(y) >= 6 ? 0 : .42 * clamp((Math.abs(Math.sin(1.08 * x)) - .025) / .08, 0, 1),
    shape: .12,
  }),
  reference({
    index: 12, id: 'reference-piecewise-pulse', name: 'Piecewise pulse', kind: 'rhythm',
    formula: 'y = { 4.25(x mod 7) − 2.4, x mod 7 < 0.8; 1.8 − (x mod 7), x mod 7 < 1.6; 2.3(x mod 7) − 3.48, x mod 7 < 2.6; 2.5 − 4.9((x mod 7 − 2.6)/4.4)², otherwise }',
    graph: x => {
      const r = mod(x, 7);
      if (r < .8) return 4.25 * r - 2.4;
      if (r < 1.6) return 1.8 - r;
      if (r < 2.6) return 2.3 * r - 3.48;
      return 2.5 - 4.9 * ((r - 2.6) / 4.4) ** 2;
    },
    graphSpan: [-28, 28], graphRange: [-2.9, 2.9], shape: .7, drive: 1.3,
  }),
  reference({
    index: 13, id: 'reference-arctangent-modulation', name: 'Arctangent modulation', kind: 'tonal',
    formula: 'y = 2arctan(2.4(−3 + ((x − (−3)) mod (3 − (−3))))) + 0.42sin(6πx)x',
    graph: x => 2 * Math.atan(2.4 * (-3 + mod(x - (-3), 3 - (-3)))) + .42 * Math.sin(6 * Math.PI * x) * x,
    graphSpan: [-9, 9], graphRange: [-7, 7],
    breakBetween: floorChanged(x => Math.floor((x + 3) / 6)), shape: .22,
  }),
];

export const FIRST_VIDEO_FUNCTIONS = REFERENCE_FUNCTIONS;
