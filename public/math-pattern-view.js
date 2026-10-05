import {MATH_SLOT_COUNT} from './math-patterns.js?v=152';

const SVG_NS = 'http://www.w3.org/2000/svg';
const WIDTH = 360;
const HEIGHT = 190;
const PLOT = {left: 37, right: 323, top: 35, bottom: 177};
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
let viewSequence = 0;

function text(node, value) {
  const next = String(value ?? '');
  if (node.textContent !== next) node.textContent = next;
}

function money(value) {
  const amount = number(value);
  const unit = amount >= 1e9 ? [1e9, 'B'] : amount >= 1e6 ? [1e6, 'M'] : amount >= 1e3 ? [1e3, 'K'] : [1, ''];
  return `$${Number((amount / unit[0]).toFixed(2))}${unit[1]}`;
}

function svgNode(name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function graphDomain(slot) {
  const source = slot.graphDomain || {};
  const xMin = number(source.xMin, -1), xMax = number(source.xMax, 1);
  const yMin = number(source.yMin, -2.5), yMax = number(source.yMax, 3);
  return {
    xMin, xMax: xMax > xMin ? xMax : xMin + 1,
    yMin, yMax: yMax > yMin ? yMax : yMin + 1,
  };
}

// Compatibility for a control-only snapshot. Graph snapshots normally provide
// the original function's raw values, already revealed up to the shared phase.
function graphPoints(slot, domain) {
  if (Array.isArray(slot.graphPoints)) return slot.graphPoints;
  const curve = slot.curve;
  if (!curve || typeof curve.length !== 'number' || curve.length < 2) return [];
  const phase = clamp(number(slot.phase, .45));
  const count = Math.max(2, Math.min(curve.length, 640));
  const points = [];
  for (let index = 0; index < count; index++) {
    const position = index / (count - 1);

    const source = position * (curve.length - 1);
    const left = Math.floor(source), fraction = source - left;
    const value = number(curve[left], .5) * (1 - fraction) + number(curve[Math.min(left + 1, curve.length - 1)], .5) * fraction;
    points.push({
      x: domain.xMin + position * (domain.xMax - domain.xMin),
      y: domain.yMin + clamp(value) * (domain.yMax - domain.yMin),
    });
  }
  return points;
}

function makeTrace(extra = false) {
  const path = svgNode('path', {class: `math-pattern-curve${extra ? ' math-pattern-overlay' : ''}`, fill: 'none'});
  const marker = svgNode('circle', {class: 'math-pattern-marker', r: extra ? '2.5' : '3.1', visibility: 'hidden'});
  return {path, marker, previous: ''};
}

function makeCard(clipId) {
  const node = document.createElement('article');
  node.className = 'math-pattern-card';
  node.innerHTML = `
    <div class="math-pattern-heading"><h4 class="math-pattern-name"></h4><span class="math-pattern-threshold"></span></div>
    <div class="math-pattern-plot"></div>`;

  const svg = svgNode('svg', {viewBox: `0 0 ${WIDTH} ${HEIGHT}`, preserveAspectRatio: 'xMidYMid meet', role: 'img'});
  const defs = svgNode('defs');
  const clip = svgNode('clipPath', {id: clipId});
  clip.append(svgNode('rect', {x: PLOT.left, y: PLOT.top, width: PLOT.right - PLOT.left, height: PLOT.bottom - PLOT.top}));
  defs.append(clip);
  const xAxis = svgNode('path', {class: 'math-pattern-axis', fill: 'none'});
  const yAxis = svgNode('path', {class: 'math-pattern-axis', fill: 'none'});
  const xArrow = svgNode('path', {class: 'math-pattern-arrow'});
  const yArrow = svgNode('path', {class: 'math-pattern-arrow'});
  const xLabel = svgNode('text', {class: 'math-pattern-axis-label', 'text-anchor': 'middle'});
  const yLabel = svgNode('text', {class: 'math-pattern-axis-label', 'text-anchor': 'middle'});
  xLabel.textContent = 'x';
  yLabel.textContent = 'y';
  const graph = svgNode('g', {'clip-path': `url(#${clipId})`});
  const trace = makeTrace();
  graph.append(trace.path, trace.marker);
  svg.append(defs, xAxis, yAxis, xArrow, yArrow, xLabel, yLabel, graph);
  node.querySelector('.math-pattern-plot').append(svg);
  return {
    node, svg, graph, trace, overlays: [], xAxis, yAxis, xArrow, yArrow, xLabel, yLabel,
    name: node.querySelector('.math-pattern-name'),
    threshold: node.querySelector('.math-pattern-threshold'),
    identity: null, rendered: false, geometry: null, domain: null,
  };
}

function drawTrace(trace, points, mapX, mapY) {
  const segments = [];
  let penDown = false, endpoint = null;
  for (const point of points) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      penDown = false;
      endpoint = null;
      continue;
    }
    const x = mapX(point.x), y = mapY(point.y);
    // The clip retains honest coordinates outside the displayed range. A
    // supplied break prevents drawing a false bridge across discontinuities.
    const command = penDown && !point.breakBefore ? 'L' : 'M';
    segments.push(`${command}${clamp(x, -100000, 100000).toFixed(2)},${clamp(y, -100000, 100000).toFixed(2)}`);
    penDown = true;
    endpoint = {x, y};
  }
  const path = segments.join(' ');
  if (trace.previous !== path) {
    trace.previous = path;
    trace.path.setAttribute('d', path);
  }
  const endpointVisible = endpoint && endpoint.x >= PLOT.left && endpoint.x <= PLOT.right
    && endpoint.y >= PLOT.top && endpoint.y <= PLOT.bottom;
  trace.marker.setAttribute('visibility', endpointVisible ? 'visible' : 'hidden');
  if (endpoint) {
    trace.marker.setAttribute('cx', String(endpoint.x));
    trace.marker.setAttribute('cy', String(endpoint.y));
  }
}

function drawGraph(card, slot) {
  const domain = graphDomain(slot);
  const mapX = value => PLOT.left + (value - domain.xMin) / (domain.xMax - domain.xMin) * (PLOT.right - PLOT.left);
  const mapY = value => PLOT.bottom - (value - domain.yMin) / (domain.yMax - domain.yMin) * (PLOT.bottom - PLOT.top);
  const hasX = domain.yMin <= 0 && domain.yMax >= 0;
  const hasY = domain.xMin <= 0 && domain.xMax >= 0;
  const axisX = mapX(0), axisY = mapY(0);
  for (const part of [card.xAxis, card.xArrow, card.xLabel]) part.setAttribute('visibility', hasX ? 'visible' : 'hidden');
  for (const part of [card.yAxis, card.yArrow, card.yLabel]) part.setAttribute('visibility', hasY ? 'visible' : 'hidden');
  card.xAxis.setAttribute('d', `M${PLOT.left},${axisY}H${PLOT.right}`);
  card.yAxis.setAttribute('d', `M${axisX},${PLOT.bottom}V${PLOT.top}`);
  card.xArrow.setAttribute('d', `M${PLOT.right},${axisY}l-7,-2.8 1.5,2.8 -1.5,2.8Z`);
  card.yArrow.setAttribute('d', `M${axisX},${PLOT.top}l-2.8,7 2.8,-1.5 2.8,1.5Z`);
  card.xLabel.setAttribute('x', String(PLOT.right + 12));
  card.xLabel.setAttribute('y', String(axisY + 4));
  card.yLabel.setAttribute('x', String(axisX));
  card.yLabel.setAttribute('y', String(PLOT.top - 11));
  const geometry=slot.graphPoints||slot.curve;
  const domainKey=Object.values(domain).join(':');
  const changed=!card.rendered||card.geometry!==geometry||card.domain!==domainKey;
  if(changed)drawTrace(card.trace, graphPoints(slot, domain), mapX, mapY);
  const overlays = Array.isArray(slot.graphOverlays) ? slot.graphOverlays : [];
  for (let index = 0; index < Math.max(overlays.length, card.overlays.length); index++) {
    if (!card.overlays[index]) {
      const trace = makeTrace(true);
      card.overlays.push(trace);
      card.graph.append(trace.path, trace.marker);
    }
    if(changed)drawTrace(card.overlays[index], Array.isArray(overlays[index]?.points) ? overlays[index].points : [], mapX, mapY);
    card.overlays[index].marker.setAttribute("visibility","hidden");
  }
  card.rendered = true;card.geometry=geometry;card.domain=domainKey;
}

function drawCursor(card,slot){
  const cursor=slot.graphCursor,domain=graphDomain(slot);
  const visible=slot.performing&&cursor&&Number.isFinite(cursor.x)&&Number.isFinite(cursor.y)
    &&cursor.x>=domain.xMin&&cursor.x<=domain.xMax&&cursor.y>=domain.yMin&&cursor.y<=domain.yMax;
  card.trace.marker.setAttribute('visibility',visible?'visible':'hidden');
  if(!visible)return;
  card.trace.marker.setAttribute('cx',String(PLOT.left+(cursor.x-domain.xMin)/(domain.xMax-domain.xMin)*(PLOT.right-PLOT.left)));
  card.trace.marker.setAttribute('cy',String(PLOT.bottom-(cursor.y-domain.yMin)/(domain.yMax-domain.yMin)*(PLOT.bottom-PLOT.top)));
}

/**
 * Draw the exact function samples supplied by the phrase engine. Each snapshot
 * supplies graphPoints and a fixed graphDomain; its last point is the endpoint.
 * Playback owns phase. Paused/inactive cards retain their last geometry, and a
 * new function or seed displays its initial preview. No separate clock runs.
 */
export function createMathPatternView(container) {
  if (!container) throw new TypeError('A container is required for the function view.');
  const root = document.createElement('section');
  root.className = 'math-pattern-view';
  root.setAttribute('aria-label', 'Functions');
  const cardsRoot = document.createElement('div');
  cardsRoot.className = 'math-pattern-cards';
  root.append(cardsRoot);
  const identity = ++viewSequence;
  const cards = Array.from({length: MATH_SLOT_COUNT}, (_, index) => makeCard(`math-graph-${identity}-${index}`));
  for (const card of cards) {
    card.node.hidden = true;
    cardsRoot.append(card.node);
  }
  root.hidden = true;
  let destroyed = false;
  container.append(root);

  function update(view = {}) {
    if (destroyed) return;
    const slots = Array.isArray(view.slots) ? view.slots.slice(0, MATH_SLOT_COUNT) : [];
    root.hidden = slots.length === 0;
    cards.forEach((card, index) => {
      const slot = slots[index];
      card.node.hidden = !slot;
      if (!slot) {
        card.rendered = false;
        return;
      }
      const nextIdentity = `${view.seed ?? ''}/${slot.slot ?? index}/${slot.id ?? slot.name ?? ''}`;
      const changed = card.identity !== nextIdentity;
      if(changed)card.rendered=false;
      card.identity = nextIdentity;
      const performing = slot.performing ?? slot.active ?? true;
      const moving = Boolean(view.playing && performing && slot.enabled !== false && view.globalEnabled !== false);
      card.node.dataset.active = String(moving);
      text(card.name, slot.name);
      const threshold = number(slot.threshold);
      card.threshold.hidden = threshold <= 0;
      text(card.threshold, threshold > 0 ? `≥ ${money(threshold)}` : '');
      card.svg.setAttribute('aria-label', `${slot.name || 'Function'}. Complete function shape; moving marker follows playback.`);
      if (changed || !card.rendered) drawGraph(card, slot);
      drawCursor(card,{...slot,performing:moving});
    });
  }

  // Retain the engine's receive API without introducing an audio meter into
  // these mathematical plots. Pd measurements do not alter function geometry.
  function receive() {}

  return {
    update,
    receive,
    destroy() {
      destroyed = true;
      root.remove();
    },
  };
}
