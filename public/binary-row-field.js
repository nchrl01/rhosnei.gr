// Independent implementation of the visible noise → remap → row displacement →
// threshold → horizontal edges → delayed samples TOP steps in the reference.
// No source shader code or reference image assets are copied into this renderer.

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const unit = (value, fallback = .5) => clamp(finite(value, fallback), 0, 1);
const smooth = value => value * value * (3 - 2 * value);
const modulo = (value, period) => ((value % period) + period) % period;
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 4;
const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const HISTOGRAM_SIZE = 1024;

function seedNumber(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  const text = String(seed ?? 0);
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) {
    value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  }
  return value >>> 0;
}

function hash(x, y, seed) {
  let value = Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(y | 0, 0x5f356495) ^ seed;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function noise(x, y, seed) {
  const left = Math.floor(x), top = Math.floor(y);
  const u = smooth(x - left), v = smooth(y - top);
  const a = hash(left, top, seed), b = hash(left + 1, top, seed);
  const c = hash(left, top + 1, seed), d = hash(left + 1, top + 1, seed);
  return a + (b - a) * u + (c - a + (d - c - b + a) * u) * v;
}

/**
 * Map normalized market observations to stable visual controls. `change` is a
 * signed change value. `time` is seconds supplied by the caller; there is no
 * internal clock, retained frame state, or random number generator.
 *
 * Rows can be selected explicitly (including 32, 64, 96, 128, and 192). The default
 * is 128. The returned dimensions are integer pixel dimensions, up to 4096.
 */
export function binaryRowParameters(options = {}) {
  const width = clamp(Math.round(finite(options.width, 640)), 1, 4096);
  const height = clamp(Math.round(finite(options.height, 640)), 1, 4096);
  const rows = clamp(Math.round(finite(options.rows, 128)), 1, Math.min(256, height));
  const activity = unit(options.activity), volume = unit(options.volume);
  const drive = unit(options.drive), pressure = unit(options.pressure);
  const balance = unit(options.balance), marketCap = unit(options.marketCap);
  const liquidity = unit(options.liquidity), change = Math.tanh(finite(options.change, 0) / 20);
  const mobile = Boolean(options.mobile);
  // A narrow rule remains a single physical pixel. At small render sizes, use
  // fewer rules so they cannot occupy the entire image or swamp the mobile view.
  const ruleStride = Math.max(1, Math.ceil(rows / (height * (mobile ? .115 : .26))));
  const ruleCount = Math.ceil(rows / ruleStride);
  const ruleCoverage = ruleCount / height;
  const targetCoverage = clamp((mobile ? .245 : .485)
    + (volume - .5) * .035 + (drive - .5) * .025 + (pressure - .5) * .025
    + (activity - .5) * .015 + (balance - .5) * .012 + change * .004,
  mobile ? .20 : .40, mobile ? .29 : .56);
  return {
    width, height, rows, seed: seedNumber(options.seed), mobile,
    time: options.reducedMotion ? 0 : finite(options.time, 0),
    dither: options.dither !== false,
    columns: clamp(Math.round(rows * width / height), 16, 768),
    ruleStride,
    targetCoverage,
    fragmentCoverage: clamp((targetCoverage - ruleCoverage) / (1 - ruleCoverage || 1), .015, .75),
    // The tutorial's -frame/512 displacement is -60/512 UV per second.
    // The caller supplies playback time; market updates cannot change phase.
    velocity: 60 / 512,
    displacement: .12,
    bandDepth: .72 + (marketCap - .5) * .06 + (liquidity - .5) * .025,
    grain: .085 + (1 - liquidity) * .035,
    threshold: .523,
    softness: .124,
    delay: options.reducedMotion ? 0 : 1 / 60,
    delayMix: 1 / 16,
  };
}

// Histogram remapping keeps the intended occupancy independent of the seed.
// It preserves correlated black bands rather than adding uniformly spread dots.
function thresholdFor(scores, fraction, histogram) {
  histogram.fill(0);
  const scale = HISTOGRAM_SIZE / 3;
  for (let index = 0; index < scores.length; index++) {
    histogram[clamp(Math.floor((scores[index] + 1) * scale), 0, HISTOGRAM_SIZE - 1)]++;
  }
  const target = scores.length * fraction;
  let count = 0;
  for (let bin = 0; bin < HISTOGRAM_SIZE; bin++) {
    const next = count + histogram[bin];
    if (next >= target) {
      const within = histogram[bin] ? (target - count) / histogram[bin] : 0;
      return (bin + within) / scale - 1;
    }
    count = next;
  }
  return 2;
}

function rowPermutation(rows, seed) {
  const permutation = Uint16Array.from({ length: rows }, (_, index) => index);
  for (let index = rows - 1; index > 0; index--) {
    const other = Math.floor(hash(index, 149, seed ^ 0x51c13) * (index + 1));
    const value = permutation[index];
    permutation[index] = permutation[other];
    permutation[other] = value;
  }
  return permutation;
}

function sampleField(parameters, scores, histogram) {
  const { rows, columns, seed, bandDepth, grain, threshold, softness } = parameters;
  const source = new Float32Array(rows * columns);
  const permutation = rowPermutation(rows, seed);
  // Build the static square noise and apply its vertical ramp before shuffling.
  // The permutation affects entire scanlines, retaining the noise's horizontal
  // correlation while redistributing dense and empty rows throughout the view.
  for (let sourceRow = 0; sourceRow < rows; sourceRow++) {
    const ramp = (sourceRow + .5) / rows;
    const noiseY = ramp * 21.5;
    const offset = sourceRow * columns;
    for (let column = 0; column < columns; column++) {
      // Neighboring cells share noise, yielding runs several cells long. Only
      // the small last term breaks a run into occasional one-cell fragments.
      const large = noise(column * .29, noiseY, seed ^ 0x92351);
      const small = noise(column * .713 + 5.31, noiseY * 2.37, seed ^ 0x6a17b);
      const detail = hash(column, sourceRow, seed ^ 0x431ff);
      source[offset + column] = large * (.74 - grain) + small * .26
        + detail * grain + (ramp - .5) * bandDepth;
    }
  }
  for (let row = 0; row < rows; row++) {
    const offset = permutation[row] * columns;
    scores.set(source.subarray(offset, offset + columns), row * columns);
  }
  // A single static remap offset controls occupancy without changing the Less
  // threshold or modulating the noise over time. Softness is confined to the
  // narrow input range immediately below that threshold.
  const remap = threshold - thresholdFor(scores, parameters.fragmentCoverage, histogram);
  const texture = new Uint8Array(scores.length);
  for (let index = 0; index < scores.length; index++) {
    texture[index] = Math.round(255 * smooth(clamp((threshold - scores[index] - remap) / softness, 0, 1)));
  }
  return texture;
}

function rowDisplacement(parameters, row, time) {
  const { columns, rows, seed, velocity, displacement } = parameters;
  const vertical = (row + .5) / rows;
  // This independent one-column noise driver is strictly positive. Repeat
  // sampling produces continuous displacement without evolving the source.
  const driver = .08 + noise(vertical * 29.7, 3.17, seed ^ 0x812ab) * .84;
  const base = (hash(row, 83, seed) - .5) * columns * displacement;
  return modulo(base - time * velocity * columns * driver, columns);
}

/**
 * Return { pixels, rows, coverage } for a Canvas2D ImageData upload.
 *
 * Pixels are straight-alpha white RGBA marks over transparent gaps. Paint black
 * behind the image for the desktop reference; leave gaps transparent for the
 * mobile overlay. `coverage` is the fraction of pixels with nonzero alpha.
 * Fragment interiors and full-width rules are solid white; the threshold has a
 * narrow soft boundary. Three analytic delayed samples (1, 2, and 3 frames at
 * 60fps) add at most 1/16 intensity around moving edges. Optional monochrome
 * dithering applies only to those trails, preserving central fragments and
 * threshold softness. Reduced motion freezes time and suppresses delay.
 */
export function renderBinaryRows(options = {}) {
  const parameters = binaryRowParameters(options);
  const { width, height, rows, columns, time, delay, dither, ruleStride } = parameters;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const packed = new Uint32Array(pixels.buffer);
  const scores = new Float32Array(rows * columns);
  const histogram = new Uint32Array(HISTOGRAM_SIZE);
  const strips = new Uint8Array(rows * width);
  const trails = new Uint16Array(rows * width);
  const cellWidth = width / columns;
  const texture = sampleField(parameters, scores, histogram);

  // Sample the same static texture at current and three adjacent-frame row
  // displacements. No mutable feedback is needed, so seeking remains exact.
  for (let sample = 3; sample >= 0; sample--) {
    if (delay === 0 && sample > 0) continue;
    const sampleTime = time - sample * delay;
    for (let row = 0; row < rows; row++) {
      const shift = rowDisplacement(parameters, row, sampleTime);
      const firstCell = Math.floor(shift);
      const scoreOffset = row * columns, stripOffset = row * width;
      // An extra cell covers the partial run at the right edge. Wrapping is in
      // pattern space; the same geometry slides continuously through the view.
      for (let cell = firstCell; cell <= firstCell + columns; cell++) {
        const alpha = texture[scoreOffset + (cell % columns)];
        if (alpha === 0) continue;
        const left = Math.max(0, Math.ceil((cell - shift) * cellWidth));
        const right = Math.min(width, Math.ceil((cell + 1 - shift) * cellWidth));
        if (sample === 0) {
          if (right > left) strips.fill(alpha, stripOffset + left, stripOffset + right);
        } else {
          for (let x = left; x < right; x++) trails[stripOffset + x] += alpha;
        }
      }
    }
  }

  let litPixels = 0;
  for (let row = 0; row < rows; row++) {
    const top = Math.floor(row * height / rows), bottom = Math.floor((row + 1) * height / rows);
    const rule = row % ruleStride === 0;
    const stripOffset = row * width;
    for (let y = top; y < bottom; y++) {
      const outputOffset = y * width;
      if (rule && y === top) {
        packed.fill(0xffffffff, outputOffset, outputOffset + width);
        litPixels += width;
        continue;
      }
      for (let x = 0; x < width; x++) {
        const central = strips[stripOffset + x];
        let trail = Math.round(trails[stripOffset + x] * parameters.delayMix / 3);
        if (dither && central === 0 && trail > 0) {
          trail = trail / 255 > (BAYER_4[(y & 3) * 4 + (x & 3)] + .5) / 16 ? 255 : 0;
        }
        const alpha = central === 255 ? 255 : Math.min(255, central + Math.round(trail * (1 - central / 255)));
        if (alpha === 0) continue;
        packed[outputOffset + x] = LITTLE_ENDIAN ? (alpha << 24) | 0xffffff : 0xffffff00 | alpha;
        litPixels++;
      }
    }
  }
  return { pixels, rows, coverage: litPixels / (width * height) };
}
