// Envion's own Pd object positions and GUI arguments drive this view.
// The browser renders the controls; it does not invent a parallel patch graph.
const NS = 'http://www.w3.org/2000/svg';
const numeric = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const limit = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const empty = v => v == null || v === 'empty' || v === '-';
const textOf = value => String(value ?? '').replace(/\\([\\ $,;])/g, '$1');

function atoms(text) {
  const result = []; let token = '', escaped = false;
  for (const character of String(text || '')) {
    if (escaped) { token += character; escaped = false; }
    else if (character === '\\') escaped = true;
    else if (/\s/.test(character)) { if (token) { result.push(token); token = ''; } }
    else token += character;
  }
  if (escaped) token += '\\';
  if (token) result.push(token);
  return result;
}

function colour(value, fallback = '#000000') {
  if (/^#[\da-f]{6}$/i.test(value)) return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return `#${((-1 - n) & 0xffffff).toString(16).padStart(6, '0')}`;
  const palette = ['#fcfcfc', '#000000', '#404040', '#606060', '#9c9c9c', '#bcbcbc', '#dcdcdc', '#fc0400', '#fc8000', '#fcfc00', '#00fc00', '#00fcfc', '#0400fc', '#9c00fc', '#fc00fc', '#fc0040', '#fcc4c4', '#fce0c4', '#fcfcc4', '#c4fcc4', '#c4fcfc', '#c4c4fc', '#e0c4fc', '#fcc4fc', '#fcc4e0', '#fcece8', '#e8e8fc', '#e8fce8', '#e8fcfc', '#fce8fc'];
  return palette[Math.trunc(n)] || fallback;
}

function elt(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function button(text, fn, label) {
  const el = elt('button', 'envion-button', text); el.type = 'button';
  if (label) el.setAttribute('aria-label', label);
  el.addEventListener('click', fn);
  return el;
}

function argumentsFor(node) {
  return Array.isArray(node.args) ? node.args.map(String) : atoms(node.text);
}

function describe(node) {
  const a = argumentsFor(node), type = node.kind === 'obj' ? a[0]?.replace(/^else\//, '') : node.kind;
  const fmatch = String(node.text || '').match(/,\s*f\s+(\d+)\s*$/);
  const body = textOf(String(node.text || '').replace(/,\s*f\s+\d+\s*$/, ''));
  const font = numeric(node.font, 10), chars = node.widthChars ?? (fmatch ? numeric(fmatch[1]) : null);
  const d = {a, type, body, width: Math.max(24, (chars || Math.min(100, body.length)) * font * .62 + 8), height: 18, font, bg: '#fff', fg: '#000', labelColour: '#000', label: '', labelX: 0, labelY: -12};
  if (type === 'hsl' || type === 'vsl') {
    Object.assign(d, {width: numeric(a[1], 128), height: numeric(a[2], 15), min: numeric(a[3]), max: numeric(a[4], 127), log: numeric(a[5]) !== 0, label: a[9], labelX: numeric(a[10]), labelY: numeric(a[11]), font: numeric(a[13], 10), bg: colour(a[14], '#fff'), fg: colour(a[15]), labelColour: colour(a[16])});
    d.normalized = limit(numeric(a[17]) / (100 * Math.max(1, (type === 'vsl' ? d.height : d.width) - 1)), 0, 1);
    d.value = fromPosition(d.normalized, d);
  } else if (type === 'tgl') {
    Object.assign(d, {width: numeric(a[1], 15), height: numeric(a[1], 15), label: a[5], labelX: numeric(a[6]), labelY: numeric(a[7]), font: numeric(a[9], 10), bg: colour(a[10], '#fff'), fg: colour(a[11]), labelColour: colour(a[12]), value: numeric(a[13]), on: numeric(a[14], 1) || 1});
  } else if (type === 'bng') {
    Object.assign(d, {width: numeric(a[1], 15), height: numeric(a[1], 15), hold: numeric(a[2], 120), label: a[7], labelX: numeric(a[8]), labelY: numeric(a[9]), font: numeric(a[11], 10), bg: colour(a[12], '#fff'), fg: colour(a[13]), labelColour: colour(a[14]), value: 0});
  } else if (type === 'hradio' || type === 'vradio') {
    const size = numeric(a[1], 15), count = limit(numeric(a[4], 8), 1, 128);
    Object.assign(d, {width: size * (type === 'hradio' ? count : 1), height: size * (type === 'vradio' ? count : 1), size, count, label: a[7], labelX: numeric(a[8]), labelY: numeric(a[9]), font: numeric(a[11], 10), bg: colour(a[12], '#fff'), fg: colour(a[13]), labelColour: colour(a[14]), value: numeric(a[15])});
  } else if (type === 'nbx') {
    Object.assign(d, {width: numeric(a[1], 5) * numeric(a[13], 10) * .65 + 16, height: numeric(a[2], 18), min: numeric(a[3]), max: numeric(a[4]), label: a[9], labelX: numeric(a[10]), labelY: numeric(a[11]), font: numeric(a[13], 10), bg: colour(a[14], '#fff'), fg: colour(a[15]), labelColour: colour(a[16]), value: numeric(a[17])});
  } else if (type === 'cnv') {
    Object.assign(d, {width: numeric(a[2], 100), height: numeric(a[3], 20), label: a[6], labelX: numeric(a[7]), labelY: numeric(a[8]) - numeric(a[10], 10) / 2, font: numeric(a[10], 10), bg: colour(a[11], '#fff'), fg: colour(a[12]), labelColour: colour(a[12])});
  } else if (type === 'knob') {
    Object.assign(d, {width: numeric(a[1], 50), height: numeric(a[1], 50), min: numeric(a[2]), max: numeric(a[3], 1), log: numeric(a[4]) !== 0, value: numeric(a[5]), bg: colour(a[8], '#fff'), fg: colour(a[10]), labelColour: colour(a[10])});
  } else if (type === 'note') {
    const width = numeric(a[1], 0), fontSize = numeric(a[2], 12), label = a.slice(15).join(' ');
    Object.assign(d, {width: width || Math.max(30, label.length * fontSize * .61), height: Math.max(fontSize * 1.2, Math.ceil(label.length * fontSize * .61 / (width || 1e9)) * fontSize * 1.2), font: fontSize, body: label, fg: `rgb(${a.slice(6, 9).map(v => limit(numeric(v), 0, 255)).join(',')})`, bg: numeric(a[13]) ? `rgb(${a.slice(10, 13).map(v => limit(numeric(v), 0, 255)).join(',')})` : 'transparent'});
  } else if (['floatatom', 'symbolatom', 'listbox'].includes(type)) {
    const fontSize = numeric(a[7], 0) || 10, len = numeric(a[0], 5) || 5;
    Object.assign(d, {width: Math.max(24, len * fontSize * .61 + 8), height: fontSize + 8, font: fontSize, min: numeric(a[1]), max: numeric(a[2]), label: a[4], value: type === 'floatatom' ? 0 : '', labelSide: numeric(a[3])});
    d.labelX = d.labelSide === 0 ? -String(d.label || '').length * fontSize * .61 - 4 : d.labelSide === 1 ? d.width + 3 : 0;
    d.labelY = d.labelSide === 2 ? -fontSize - 2 : d.labelSide === 3 ? d.height + 2 : 0;
  } else if (type === 'text') {
    const width = Math.max(30, chars ? chars * font * .62 : Math.min(80, body.length) * font * .62);
    Object.assign(d, {width, height: Math.max(14, Math.ceil(body.length * font * .62 / width) * 13), bg: 'transparent'});
  } else if (type === 'pic') {
    Object.assign(d, {width: numeric(node.width, 60), height: numeric(node.height, 60), bg: 'transparent'});
  } else if (type === 'scope~' || type === 'scope3d' || type === 'meter2~') {
    Object.assign(d, {width: numeric(a[1], 100), height: numeric(a[2], 70), bg: '#fff'});
  }
  d.width = limit(d.width, 8, 1600); d.height = limit(d.height, 8, 1000);
  return d;
}

function fromPosition(position, d) {
  if (d.log && d.min > 0 && d.max > 0) return d.min * Math.pow(d.max / d.min, position);
  return d.min + position * (d.max - d.min);
}

function toPosition(value, d) {
  if (d.min === d.max) return 0;
  if (d.log && d.min > 0 && d.max > 0 && value > 0) return limit(Math.log(value / d.min) / Math.log(d.max / d.min), 0, 1);
  return limit((value - d.min) / (d.max - d.min), 0, 1);
}

function showNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Number(value.toPrecision(7)).toString() : String(value ?? '');
}

/** Render a source-derived Envion patch and relay controls to its Pd receivers. */
export function createEnvionView(container, {onControl = () => {}, onFile = () => {}, onCommand = () => {}} = {}) {
  container.classList.add('envion-view');
  const toolbar = elt('div', 'envion-toolbar'), files = elt('div', 'envion-file-actions'), nav = elt('div', 'envion-navigation');
  const viewport = elt('div', 'envion-viewport'), spacer = elt('div', 'envion-spacer'), surface = elt('div', 'envion-surface');
  const status = elt('span', 'envion-status', 'Loading original patch…'), zoomValue = elt('output', 'envion-zoom', '100%');
  const fileRequest = elt('div', 'envion-file-request'), fileRequestText = elt('span');
  let requestedFileId = null;
  const fileRequestButton = button('Choose file', () => { if (requestedFileId) onCommand('file:' + requestedFileId); });
  fileRequest.hidden = true; fileRequest.setAttribute('aria-live', 'polite'); fileRequest.append(fileRequestText, fileRequestButton);
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  viewport.tabIndex = 0; viewport.setAttribute('aria-label', 'Envion Pure Data patch. Scroll to explore, or use the zoom controls.');
  spacer.append(surface); viewport.append(spacer);
  let model, current, trail = [], zoom = 1, fitting = true, running = false, clockMode = 'market', bounds = {x: 0, y: 0, width: 1000, height: 650}, frame = 0, destroyed = false;
  let waveform = null;
  const scopeValues=new Map(),scopeViews=new Map(),canvasViews=new Map(),canvasValues=new Map();
  const values = new Map(), controls = new Map(), arrayValues = new Map(), drawings = [], pending = new Map(), timers = new Set();
  const credit = elt('a', 'envion-credit', 'ENVION · Emiliano Pennisi');
  credit.href = 'https://www.peamarte.it/env/envion_v3.6.html'; credit.target = '_blank'; credit.rel = 'noopener noreferrer';
  const port = elt('span', 'envion-port', 'BROWSER PORT');
  const transport = button('Start audio', () => onCommand(running ? 'stop' : 'start'));
  transport.setAttribute('aria-pressed', 'false');
  const clockChoices = elt('div', 'envion-clock-choices'); clockChoices.setAttribute('role', 'group'); clockChoices.setAttribute('aria-label', 'Envion clock source');
  const marketClock = button('Market clock', () => { setClockMode('market'); onCommand('market'); });
  const originalClock = button('Original clocks', () => { setClockMode('original'); onCommand('original'); });
  clockChoices.append(marketClock, originalClock);
  function setClockMode(mode) {
    clockMode = mode === 'original' ? 'original' : 'market';
    marketClock.setAttribute('aria-pressed', String(clockMode === 'market'));
    originalClock.setAttribute('aria-pressed', String(clockMode === 'original'));
  }
  setClockMode('market');
  const audioInput = elt('input'); audioInput.type = 'file'; audioInput.accept = 'audio/*,.wav,.aif,.aiff,.flac'; audioInput.hidden = true;
  const scoreInput = elt('input'); scoreInput.type = 'file'; scoreInput.accept = '.txt,text/plain'; scoreInput.hidden = true;
  async function chooseFile(file) {
    if (!file) return;
    status.textContent = `Loading ${file.name}…`;
    try { await onFile(file); } catch (error) { status.textContent = `Could not load ${file.name}: ${error.message || error}`; }
  }
  for (const input of [audioInput, scoreInput]) input.addEventListener('change', () => { chooseFile(input.files?.[0]); input.value = ''; });
  files.append(transport, clockChoices, button('Open audio', () => audioInput.click()), button('Open envelope text', () => scoreInput.click()), button('Export patch recording', () => onCommand('export')), audioInput, scoreInput);
  toolbar.append(credit, port, files, status);
  const crumbs = elt('div', 'envion-breadcrumbs'); crumbs.setAttribute('aria-label', 'Patch path');
  const zoomControls = elt('div', 'envion-zoom-controls');
  zoomControls.append(button('−', () => setZoom(zoom / 1.25), 'Zoom out'), zoomValue, button('+', () => setZoom(zoom * 1.25), 'Zoom in'), button('Fit', () => { fitting = true; fit(); }), button('100%', () => setZoom(1)));
  nav.append(crumbs, zoomControls);
  const hint = elt('p', 'envion-hint', 'Original patch layout · Controls send to Pure Data · Click a subpatch to open it');
  container.replaceChildren(toolbar, fileRequest, nav, viewport, hint);

  function setZoom(value, keepFit = false) {
    const old = zoom, centerX = viewport.scrollLeft + viewport.clientWidth / 2, centerY = viewport.scrollTop + viewport.clientHeight / 2;
    zoom = limit(value, .08, 3); if (!keepFit) fitting = false;
    surface.style.transform = `scale(${zoom})`;
    spacer.style.width = `${Math.ceil(bounds.width * zoom)}px`; spacer.style.height = `${Math.ceil(bounds.height * zoom)}px`;
    zoomValue.value = `${Math.round(zoom * 100)}%`; zoomValue.textContent = zoomValue.value;
    viewport.scrollLeft = centerX / old * zoom - viewport.clientWidth / 2;
    viewport.scrollTop = centerY / old * zoom - viewport.clientHeight / 2;
  }
  function fit() {
    if (!viewport.clientWidth) return;
    setZoom(Math.min(1, (viewport.clientWidth - 18) / bounds.width), true);
    viewport.scrollLeft = 0; viewport.scrollTop = 0;
  }
  function send(node, selector, data = []) {
    if (!node.send) return;
    onControl({receiver: node.send, selector, values: data});
  }
  function flash(el, duration = 110) {
    el.classList.add('envion-pulse');
    const timer = setTimeout(() => { el.classList.remove('envion-pulse'); timers.delete(timer); }, limit(duration, 50, 250));
    timers.add(timer);
  }
  function register(node, update) {
    if (!node.receive) return;
    const receiver = String(node.receive);
    if (!controls.has(receiver)) controls.set(receiver, []);
    controls.get(receiver).push(update);
    if (values.has(receiver)) update(values.get(receiver));
  }
  function accessible(el, node, d) {
    const label = !empty(d.label) ? d.label : `${d.type} ${node.index}`;
    el.setAttribute('aria-label', label);
    if (!node.send) { el.disabled = true; el.setAttribute('aria-label', `${label}, read only`); }
  }
  function makeLabel(parent, d) {
    if (empty(d.label)) return;
    const label = elt('span', 'envion-control-label', textOf(d.label));
    label.style.left = `${d.labelX}px`; label.style.top = `${d.labelY}px`;
    label.style.color = d.labelColour; label.style.fontSize = `${d.font}px`;
    parent.append(label); return label;
  }
  function scalar(data, fallback = 0) {
    const clean = data?.[0] === 'set' ? data.slice(1) : data;
    return clean?.length ? clean[0] : fallback;
  }
  function buildNode(node, d) {
    const box = elt('div', `envion-node envion-${d.type.replace(/[^a-z\d-]/gi, '')}`);
    box.style.cssText = `left:${numeric(node.x) - bounds.x}px;top:${numeric(node.y) - bounds.y}px;width:${d.width}px;height:${d.height}px;--envion-bg:${d.bg};--envion-fg:${d.fg};--envion-toggle-size:${d.height * .9};font-size:${d.font}px`;
    box.title = d.body; box.dataset.node = String(node.index);
    if (d.type === 'cnv') { box.style.zIndex='0';const label=makeLabel(box,d);if(node.canvasTap){const apply=data=>{if(data[0]==='label'&&label)label.textContent=data.slice(1).join(' ');if(data[0]==='color'){box.style.setProperty('--envion-bg',colour(data[1]));if(label)label.style.color=colour(data[3]??data[2]);}};canvasViews.set(node.canvasTap,apply);if(canvasValues.has(node.canvasTap))apply(canvasValues.get(node.canvasTap));}return box; }
    if (d.type === 'text' || d.type === 'note') { box.textContent = d.body; return box; }
    if (d.type === 'pic') {
      // Asset URLs must be explicitly supplied by the model; source file paths are never opened.
      const asset = node.asset || model.images?.[d.a[2]]?.url;
      if (asset && /^\.?\/?[\w./% -]+\.(gif|png|jpg|jpeg|webp|svg)$/i.test(asset) && !asset.includes('..')) {
        const img = elt('img'); img.src = asset; img.alt = d.a[2] || 'Envion illustration'; img.draggable = false; box.append(img);
      } else { box.classList.add('envion-asset-missing'); box.textContent = d.a[2] || 'image'; box.title = 'Original image asset is unavailable in this browser port.'; }
      return box;
    }
    if (['hsl', 'vsl', 'knob'].includes(d.type)) {
      let value = d.value;
      const input = elt('input', 'envion-slider'); input.type = 'range'; input.min = '0'; input.max = '1'; input.step = '0.00001'; input.value = toPosition(value, d);
      if (d.type === 'vsl') input.classList.add('envion-slider-vertical');
      accessible(input, node, d); box.append(input); makeLabel(box, d);
      let needle;
      if (d.type === 'knob') {
        const dial = elt('span', 'envion-dial'); needle = elt('span', 'envion-dial-needle'); dial.append(needle); box.prepend(dial); input.classList.add('envion-knob-input');
      }
      function set(valueInput) {
        value = numeric(valueInput, value); const p = toPosition(value, d);
        input.value = p; input.setAttribute('aria-valuetext', showNumber(value)); box.title = `${d.body}\n${showNumber(value)}`;
        if (needle) needle.style.transform = `rotate(${-135 + 270 * p}deg)`;
      }
      input.addEventListener('input', () => { set(fromPosition(numeric(input.value), d)); send(node, 'float', [value]); });
      register(node, data => {
        if (data[0] === 'range' && data.length > 2) { d.min = numeric(data[1], d.min); d.max = numeric(data[2], d.max); set(value); }
        else set(scalar(data, value));
      }); set(value); return box;
    }
    if (d.type === 'bng' || d.type === 'tgl') {
      let value = d.value;
      const input = button('', () => {
        if (d.type === 'bng') { flash(input, d.hold); send(node, 'bang'); }
        else { value = value ? 0 : d.on; paint(); send(node, 'float', [value]); }
      }); input.className = `envion-${d.type}-control`; accessible(input, node, d);
      function paint() { if (d.type === 'tgl') { input.textContent = value ? '×' : ''; input.setAttribute('aria-pressed', String(Boolean(value))); } }
      register(node, data => { if (d.type === 'bng') { if (data[0] !== 'set') flash(input, d.hold); } else { value = numeric(scalar(data), value); paint(); } });
      box.append(input); makeLabel(box, d); paint(); return box;
    }
    if (d.type === 'hradio' || d.type === 'vradio') {
      let value = d.value; const options = [];
      box.setAttribute('role', 'group'); box.setAttribute('aria-label', !empty(d.label) ? d.label : 'Radio selector');
      function paint() { options.forEach((option, i) => { option.classList.toggle('envion-selected', i === Math.trunc(value)); option.setAttribute('aria-pressed', String(i === Math.trunc(value))); }); }
      for (let i = 0; i < d.count; i++) {
        const option = button('', () => { value = i; paint(); send(node, 'float', [i]); }, `Select ${i}`);
        option.className = 'envion-radio-option'; option.style.width = `${d.size}px`; option.style.height = `${d.size}px`; option.disabled = !node.send;
        options.push(option); box.append(option);
      }
      register(node, data => { value = numeric(scalar(data), value); paint(); }); makeLabel(box, d); paint(); return box;
    }
    if (['floatatom', 'symbolatom', 'listbox', 'nbx'].includes(d.type)) {
      const input = elt('input', 'envion-atom-control'); input.type = 'text'; input.value = showNumber(d.value); input.autocomplete = 'off'; input.spellcheck = false;
      input.inputMode = ['floatatom', 'nbx'].includes(d.type) ? 'decimal' : 'text'; accessible(input, node, d);
      let previous = input.value;
      const submit = () => {
        if (input.value === previous) return;
        if (d.type === 'floatatom' || d.type === 'nbx') {
          let value = Number(input.value); if (!Number.isFinite(value)) { input.value = previous; return; }
          if (d.min !== d.max) value = limit(value, Math.min(d.min, d.max), Math.max(d.min, d.max));
          input.value = showNumber(value); send(node, 'float', [value]);
        } else if (d.type === 'symbolatom') send(node, 'symbol', [input.value]);
        else send(node, 'list', atoms(input.value).map(v => v.trim() && Number.isFinite(Number(v)) ? Number(v) : v));
        previous = input.value;
      };
      input.addEventListener('change', submit); input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); submit(); input.blur(); } if (event.key === 'Escape') { input.value = previous; input.blur(); } });
      register(node, data => { const clean = data[0] === 'set' ? data.slice(1) : data; previous = clean.map(showNumber).join(' '); if (document.activeElement !== input) input.value = previous; });
      box.append(input); makeLabel(box, d); return box;
    }
    if (node.child) {
      const child = model.canvases[node.child];
      const arrays = child?.arrays || child?.nodes?.filter(n => n.kind === 'array').map(n => ({name: argumentsFor(n)[0], data: n.data}));
      if (child?.coords && arrays?.length) {
        const graph = elt('canvas', 'envion-array'); graph.width = Math.round(d.width); graph.height = Math.round(d.height); graph.setAttribute('aria-label', `Sample array ${arrays[0].name || ''}`);
        box.append(graph); drawings.push({canvas: graph, name: arrays[0].name, data: arrays[0].data});
        const open = button(arrays[0].name || 'array', () => navigate(node.child), `Open ${arrays[0].name || 'array'}`); open.className = 'envion-array-open'; box.append(open);
        return box;
      }
      if (child?.coords && numeric(child.coords[6]) > 0) {
        box.classList.add('envion-gop'); box.tabIndex = 0; box.setAttribute('role', 'group'); box.setAttribute('aria-label', `${d.body}; press Enter to open subpatch`);
        const originX = numeric(child.coords[7]), originY = numeric(child.coords[8]);
        for (const inner of child.nodes || []) {
          const innerDescription = describe(inner), innerCanvas = model.canvases[inner.child];
          if (innerCanvas?.coords) { innerDescription.width = numeric(innerCanvas.coords[4], innerDescription.width); innerDescription.height = numeric(innerCanvas.coords[5], innerDescription.height); }
          const visible = ['cnv', 'bng', 'tgl', 'hsl', 'vsl', 'nbx', 'hradio', 'vradio', 'knob', 'note', 'text', 'floatatom', 'listbox', 'symbolatom'].includes(innerDescription.type) || innerCanvas?.coords;
          const x = numeric(inner.x) - originX, y = numeric(inner.y) - originY;
          if (!visible || x + innerDescription.width < 0 || y + innerDescription.height < 0 || x > d.width || y > d.height) continue;
          const rendered = buildNode(inner, innerDescription); rendered.style.left = `${x}px`; rendered.style.top = `${y}px`; box.append(rendered);
        }
        box.addEventListener('dblclick', event => { if (event.target === box) navigate(node.child); });
        box.addEventListener('keydown', event => { if (event.target === box && event.key === 'Enter') { event.preventDefault(); navigate(node.child); } });
        return box;
      }
      const open = button(d.body, () => navigate(node.child), `Open ${d.body}`); open.className = 'envion-object-control envion-subpatch-control'; box.append(open); return box;
    }
    if (d.type === 'scope~' || d.type === 'scope3d' || d.type === 'meter2~') {
      const canvas=elt('canvas','envion-array');canvas.width=Math.ceil(d.width);canvas.height=Math.ceil(d.height);box.append(canvas);
      if(node.scopeTap)scopeViews.set(node.scopeTap,{canvas,d,meter:d.type==='meter2~'});
      return box;
    }
    if (node.kind === 'msg') {
      const msg = button(d.body, () => { flash(msg); send(node, 'bang'); }); msg.className = 'envion-message-control'; msg.disabled = !node.send; box.append(msg);
      register(node, data => { if (data[0] === 'set') msg.textContent = data.slice(1).map(showNumber).join(' '); else flash(msg); });
    } else { const body = elt('span', 'envion-object-body', d.body); box.append(body); }
    return box;
  }

  function drawWaveforms() {
    for (const item of drawings) {
      const ctx = item.canvas.getContext('2d'); if (!ctx) continue;
      const {width, height} = item.canvas; ctx.clearRect(0, 0, width, height);
      const isSample = /^samplebuf[LR]$/.test(item.name || '');
      const samples = arrayValues.get(item.name) || (item.data?.length ? item.data : isSample ? waveform?.[/R$/i.test(item.name || '') ? 1 : 0] : null);
      if (!samples?.length) { ctx.fillStyle = '#777'; ctx.font = '10px Arial'; ctx.fillText(isSample ? 'No sample loaded' : 'Awaiting array data', 5, height / 2); continue; }
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const start = Math.floor(x / width * samples.length), end = Math.max(start + 1, Math.floor((x + 1) / width * samples.length));
        let min = 0, max = 0; const step = Math.max(1, Math.floor((end - start) / 48));
        for (let i = start; i < end; i += step) { const v = numeric(samples[i]); min = Math.min(min, v); max = Math.max(max, v); }
        ctx.moveTo(x + .5, (1 - limit(max, -1, 1)) * height / 2); ctx.lineTo(x + .5, (1 - limit(min, -1, 1)) * height / 2);
      } ctx.stroke();
    }
  }

  function drawScopes(){
    for(const [id,{canvas,d,meter}] of scopeViews){
      const data=scopeValues.get(id),ctx=canvas.getContext('2d');if(!ctx)continue;
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      if(!data?.[0])continue;
      ctx.strokeStyle='#111';ctx.fillStyle='#111';
      if(meter){for(let c=0;c<2;c++){const a=data[c]||[],rms=Math.sqrt(a.reduce((sum,v)=>sum+v*v,0)/Math.max(1,a.length));const h=limit((20*Math.log10(Math.max(1e-6,rms))+60)/60,0,1)*canvas.height;ctx.fillRect(c*canvas.width/2,canvas.height-h,canvas.width/2-3,h);}continue;}
      const lo=numeric(d.a[6],-1),hi=numeric(d.a[7],1),a=data[0];ctx.beginPath();
      for(let x=0;x<canvas.width;x++){const v=a[Math.min(a.length-1,Math.floor(x/canvas.width*a.length))],y=canvas.height*(1-limit((v-lo)/(hi-lo||2),0,1));x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
    }
  }
  function render() {
    const canvas = model?.canvases?.[current]; if (!canvas) return;
    controls.clear();scopeViews.clear();canvasViews.clear(); drawings.length = 0; surface.replaceChildren();
    const nodes = (canvas.nodes || []).filter(n => !['declare', 'scalar'].includes(n.kind)), descriptions = new Map(nodes.map(n => [n.index, describe(n)]));
    for (const node of nodes) {
      const d = descriptions.get(node.index), child = model.canvases[node.child];
      if (child?.coords && numeric(child.coords[6]) > 0) { d.width = numeric(child.coords[4], d.width); d.height = numeric(child.coords[5], d.height); }
      const image = d.type === 'pic' ? model.images?.[d.a[2]] : null;
      if (image) { d.width = numeric(image.width, d.width); d.height = numeric(image.height, d.height); }
    }
    const minX = Math.min(0, ...nodes.map(n => numeric(n.x))), minY = Math.min(0, ...nodes.map(n => numeric(n.y)));
    // Keep source coordinates intact, while avoiding large empty margins around the source drawing.
    bounds = {x: nodes.length ? Math.min(...nodes.map(n => numeric(n.x))) - 24 : minX, y: nodes.length ? Math.min(...nodes.map(n => numeric(n.y))) - 28 : minY,
      width: 0, height: 0};
    bounds.width = Math.max(320, ...nodes.map(n => numeric(n.x) + descriptions.get(n.index).width - bounds.x + 32));
    bounds.height = Math.max(200, ...nodes.map(n => numeric(n.y) + descriptions.get(n.index).height - bounds.y + 40));
    surface.style.width = `${bounds.width}px`; surface.style.height = `${bounds.height}px`;
    const wires = document.createElementNS(NS, 'svg'); wires.classList.add('envion-wires'); wires.setAttribute('width', bounds.width); wires.setAttribute('height', bounds.height); wires.setAttribute('aria-hidden', 'true');
    const byIndex = new Map(nodes.map(n => [n.index, n])), outlets = new Map(), inlets = new Map();
    for (const [source, out, dest, inlet] of canvas.wires || []) { outlets.set(source, Math.max(outlets.get(source) || 1, out + 1)); inlets.set(dest, Math.max(inlets.get(dest) || 1, inlet + 1)); }
    for (const [source, out, dest, inlet] of canvas.wires || []) {
      const s = byIndex.get(source), t = byIndex.get(dest); if (!s || !t) continue;
      const sd = descriptions.get(source), td = descriptions.get(dest);
      const sx = numeric(s.x) - bounds.x + 3 + out * (sd.width - 6) / Math.max(1, outlets.get(source) - 1), sy = numeric(s.y) - bounds.y + sd.height;
      const tx = numeric(t.x) - bounds.x + 3 + inlet * (td.width - 6) / Math.max(1, inlets.get(dest) - 1), ty = numeric(t.y) - bounds.y;
      const line = document.createElementNS(NS, 'path'); line.setAttribute('d', `M${sx},${sy} L${tx},${ty}`);
      line.setAttribute('class', /~/.test(sd.a[0] || '') ? 'envion-audio-wire' : 'envion-control-wire'); wires.append(line);
    }
    surface.append(wires);
    const fragment = document.createDocumentFragment();
    for (const node of nodes) fragment.append(buildNode(node, descriptions.get(node.index)));
    surface.append(fragment); drawWaveforms();drawScopes();
    crumbs.replaceChildren();
    trail.forEach((id, i) => { if (i) crumbs.append(elt('span', 'envion-crumb-separator', '/')); const c = model.canvases[id]; const link = button(i === 0 ? 'ENVION' : c?.name || id, () => { trail = trail.slice(0, i + 1); current = id; render(); }); link.disabled = i === trail.length - 1; crumbs.append(link); });
    fitting ? fit() : setZoom(zoom, true);
  }
  function navigate(id) { if (!model?.canvases?.[id]) return; current = id; trail.push(id); render(); viewport.scrollLeft = 0; viewport.scrollTop = 0; }
  function flush() {
    frame = 0; if (destroyed) return;
    for (const [receiver, data] of pending) { values.set(receiver, data); for (const update of controls.get(receiver) || []) update(data); }
    pending.clear();
  }
  viewport.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); viewport.classList.add('envion-dragover'); } });
  viewport.addEventListener('dragleave', () => viewport.classList.remove('envion-dragover'));
  viewport.addEventListener('drop', event => { event.preventDefault(); viewport.classList.remove('envion-dragover'); chooseFile(event.dataTransfer?.files?.[0]); });
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (fitting) fit(); }) : null; observer?.observe(viewport);
  return {
    load(nextModel) { model = nextModel; current = model.root; trail = [current]; values.clear(); pending.clear(); fitting = true; render(); },
    receive(receiver, data) { if (destroyed) return; pending.set(String(receiver), Array.isArray(data) ? data : [data]); if (!frame) frame = requestAnimationFrame(flush); },
    setScopes(data){for(const [id,channels] of Object.entries(data))scopeValues.set(id,channels);drawScopes();},
    receiveCanvas(id,data){canvasValues.set(id,data);canvasViews.get(id)?.(data);},
    setStatus(text) { status.textContent = String(text); },
    requestFile(id, mode = '0') {
      requestedFileId = id ? String(id) : null;
      fileRequest.hidden = !requestedFileId;
      if (!requestedFileId) return;
      const folder = String(mode) === '1' || mode === 'folder', multiple = String(mode) === '2' || mode === 'multiple';
      fileRequestText.textContent = folder ? 'The patch is waiting for a local audio folder.' : multiple ? 'The patch is waiting for audio files.' : 'The patch is waiting for a local file.';
      fileRequestButton.textContent = folder ? 'Choose folder' : multiple ? 'Choose files' : 'Choose file';
    },
    setRunning(value) { running = Boolean(value); transport.textContent = running ? 'Stop audio' : 'Start audio'; transport.setAttribute('aria-pressed', String(running)); },
    setClockMode,
    setWaveform(channels) { waveform = channels; drawWaveforms(); },
    setArray(name, samples) { arrayValues.set(name, samples); drawWaveforms(); },
    destroy() { destroyed = true; observer?.disconnect(); if (frame) cancelAnimationFrame(frame); for (const timer of timers) clearTimeout(timer); container.replaceChildren(); }
  };
}
