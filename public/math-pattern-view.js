import {MATH_SLOT_COUNT} from './math-patterns.js?v=53';
const SVG_NS = 'http://www.w3.org/2000/svg';
const WIDTH = 280;
const HEIGHT = 82;
const INSET = 5;
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const text = (node, value) => {
  const next = String(value);
  if (node.textContent !== next) node.textContent = next;
};

function money(value) {
  const amount = number(value);
  if (amount <= 0) return '—';
  const unit = amount >= 1e9 ? [1e9, 'B'] : amount >= 1e6 ? [1e6, 'M'] : amount >= 1e3 ? [1e3, 'K'] : [1, ''];
  return `$${Number((amount / unit[0]).toFixed(2))}${unit[1]}`;
}

function midi(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const note = Math.round(Number(value));
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  return `${names[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1} · MIDI ${note}`;
}

function svgNode(name, attributes) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function curvePoints(curve) {
  if (!curve || typeof curve.length !== 'number' || curve.length < 2) return [];
  // Bound DOM work even if a source supplies an audio-sized buffer.
  const count = Math.min(curve.length, 320);
  return Array.from({length: count}, (_, index) => {
    const source = Math.round(index * (curve.length - 1) / (count - 1));
    return clamp(number(curve[source], .5));
  });
}

function pathFor(points) {
  return points.map((point, index) => {
    const x = INSET + index * (WIDTH - INSET * 2) / (points.length - 1);
    const y = HEIGHT - INSET - point * (HEIGHT - INSET * 2);
    return `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

function makeCard(onToggle) {
  const node = document.createElement('article');
  node.className = 'math-pattern-card';
  node.innerHTML = `
    <div class="math-pattern-heading">
      <div class="math-pattern-identity"><h4></h4><span class="math-pattern-threshold"></span></div>
      <button type="button" class="math-pattern-toggle" disabled>Sound off</button>
    </div>
    <div class="math-pattern-plot"></div><div class="math-phrase-progress" aria-hidden="true"><span></span></div>
    <div class="math-pattern-caption"><span class="math-pattern-state"></span><span class="math-pattern-beats">8 beats</span></div>
    <details class="math-pattern-details">
      <summary>Function details</summary>
      <div class="math-pattern-formula"></div>
      <dl>
        <dt>Pitch</dt><dd class="math-pattern-pitch"></dd>
        <dt>Control value</dt><dd class="math-pattern-value"></dd>
        <dt>Gate</dt><dd class="math-pattern-gate"></dd>
        <dt>Pd RMS · before master</dt><dd class="math-pattern-level"></dd>
      </dl>
      <p>The curve controls pitch across one eight-beat phrase, then rests. Fresh chart activity can trigger another phrase after at least 24 beats. Pd output is the measured audio level before master volume.</p>
    </details>`;
  const get = selector => node.querySelector(selector);
  const svg = svgNode('svg', {viewBox: `0 0 ${WIDTH} ${HEIGHT}`, preserveAspectRatio: 'none', role: 'img'});
  const baseline = svgNode('path', {d: `M${INSET},${HEIGHT - INSET}H${WIDTH - INSET}`, class: 'math-pattern-baseline'});
  const curve = svgNode('path', {class: 'math-pattern-curve', fill: 'none'});
  const marker = svgNode('circle', {class: 'math-pattern-marker', r: '2.5', cx: String(INSET), cy: String(HEIGHT - INSET), visibility: 'hidden'});
  svg.append(baseline, curve, marker);
  get('.math-pattern-plot').append(svg);
  const card = {
    node, svg, curve, marker,
    name: get('h4'), threshold: get('.math-pattern-threshold'), toggle: get('button'),
    state: get('.math-pattern-state'), formula: get('.math-pattern-formula'),
    pitch: get('.math-pattern-pitch'), value: get('.math-pattern-value'),
    gate: get('.math-pattern-gate'), level: get('.math-pattern-level'),
    slot: null, enabled: false, path: '', id: null,progress:get('.math-phrase-progress span'),beats:get('.math-pattern-beats'),
  };
  card.toggle.addEventListener('click', () => {
    if (card.slot != null) onToggle?.(card.slot, !card.enabled);
  });
  return card;
}

/**
 * A view of the same control functions used by the audio engine.
 * update() accepts five selected slots. receive() accepts dBFS from Pd.
 * Nodes are retained on every update, including open details and keyboard focus.
 */
export function createMathPatternView(container, {onToggle} = {}) {
  if (!container) throw new TypeError('A container is required for the market function view.');
  const root = document.createElement('section');
  root.className = 'math-pattern-view';
  root.setAttribute('aria-label', 'Market sound functions');
  root.innerHTML = `
    <header class="math-pattern-header"><h3>Market phrases</h3><span class="math-pattern-seed"></span></header>
    <p class="math-pattern-waiting">Five seeded functions · eight beats each · follows playback.</p>
    <div class="math-pattern-cards"></div>`;
  const seed = root.querySelector('.math-pattern-seed');
  const waiting = root.querySelector('.math-pattern-waiting');
  const cardsRoot = root.querySelector('.math-pattern-cards');
  const cards = Array.from({length:MATH_SLOT_COUNT},()=>makeCard(onToggle));
  for (const card of cards) {
    card.node.hidden = true;
    cardsRoot.append(card.node);
  }
  const levels = new Map();
  let destroyed = false;
  let currentSeed;
  container.append(root);

  function drawLevel(card) {
    const measured = levels.get(String(card.slot));
    text(card.level, measured === undefined ? 'Awaiting audio' : measured === -Infinity ? '−∞ dBFS' : `${measured.toFixed(1)} dBFS`);
  }

  function update(view = {}) {
    if (destroyed) return;
    const slots = Array.isArray(view.slots) ? view.slots.slice(0, MATH_SLOT_COUNT) : [];
    if (currentSeed !== view.seed) {
      currentSeed = view.seed;
      levels.clear();
    }
    const identity = view.seed == null ? '' : `Seed ${String(view.seed)}`;
    text(seed, identity ? `${identity} · ${number(view.tempo,40)} BPM` : 'Waiting for a coin');
    seed.title = identity;
    waiting.hidden = slots.length > 0;
    cardsRoot.hidden = slots.length === 0;
    cards.forEach((card, index) => {
      const slot = slots[index];
      card.node.hidden = !slot;
      if (!slot) return;
      const nextSlot = slot.slot ?? index;
      if (card.slot !== nextSlot || card.id !== slot.id) levels.delete(String(nextSlot));
      card.slot = nextSlot;
      card.id = slot.id;
      card.enabled = slot.enabled !== false;
      card.node.dataset.enabled = String(card.enabled);
      card.node.dataset.active = String(Boolean(slot.active && view.playing && card.enabled));
      text(card.name, slot.name || 'Market function');
      text(card.threshold, number(slot.threshold) > 0 ? `${String(index+1).padStart(2,'0')} / ${slot.unlocked ? 'Reached' : 'At'} ${money(slot.threshold)}` : 'Market driven');
      card.toggle.disabled = view.globalEnabled === false;
      card.toggle.title = view.globalEnabled === false ? 'Restore the math functions bundle in pdata first.' : '';
      text(card.toggle, card.enabled ? 'Sound on' : 'Sound off');
      card.toggle.setAttribute('aria-pressed', String(card.enabled));
      card.toggle.setAttribute('aria-label', `${slot.name || 'Market function'} sound`);
      const status = !card.enabled ? 'Muted' : !view.playing ? 'Paused' : slot.status || (slot.active ? 'Playing' : 'Waiting for market');
      text(card.state, status);
      text(card.formula, slot.formula || 'Function follows the market signal.');
      text(card.pitch, midi(slot.pitch));
      text(card.value, slot.value == null ? '—' : number(slot.value).toFixed(3));
      text(card.gate, !view.playing || !card.enabled ? 'Closed' : number(slot.gate) > 0 ? 'Open' : 'Closed');
      drawLevel(card);
      const points = curvePoints(slot.curve);
      const path = pathFor(points);
      if (card.path !== path) {
        card.path = path;
        card.curve.setAttribute('d', path);
      }
      card.svg.setAttribute('aria-label', `${slot.name || 'Market'} pitch control function across eight beats. ${status}.`);
      card.marker.setAttribute('visibility', points.length&&slot.performing&&view.playing ? 'visible' : 'hidden');
      card.progress.style.width=slot.performing&&view.playing?`${clamp(number(slot.phase))*100}%`:'0%';
      text(card.beats,slot.performing&&view.playing?`${number(slot.beats).toFixed(1)} / 8 beats`:'8 beats · then rest');
      if (points.length) {
        const phase = clamp(number(slot.phase));
        const y = clamp(number(slot.value));
        card.marker.setAttribute('cx', String(INSET + phase * (WIDTH - INSET * 2)));
        card.marker.setAttribute('cy', String(HEIGHT - INSET - y * (HEIGHT - INSET * 2)));
      }
    });
  }

  function receive(slot, db) {
    if (destroyed) return;
    const measured = Number(db);
    if (Number.isNaN(measured) || measured === Infinity) return;
    levels.set(String(slot), measured);
    for (const card of cards) if (String(card.slot) === String(slot)) drawLevel(card);
  }

  return {
    update,
    receive,
    destroy() {
      destroyed = true;
      levels.clear();
      root.remove();
    },
  };
}
