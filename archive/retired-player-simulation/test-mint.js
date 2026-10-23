import {TEST_CAPS, TEST_MILESTONES, testStage, validTestCap} from './test-evolution.js?v=1';
const STORAGE_KEY = 'upic:test-mints:v1';
const EVOLUTION_KEY = 'upic:test-evolution:v1';
const PREVIEW_MS = 20_000;

// Browser-only playback simulation. Never supplies collection or wallet proofs.
export function createTestMint(host, {onPreviewEnd, onChange, storage, now = () => performance.now()} = {}) {
  try { storage ??= globalThis.localStorage; } catch {}
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('./test-mint.css?v=3', import.meta.url).href;
  document.head.append(style);
  const panel = document.createElement('div');
  panel.className = 'test-mint';
  panel.innerHTML = '<button type="button" class="test-mint-toggle" role="switch" aria-checked="false" disabled>Test mint</button><button type="button" class="test-mint-reset" hidden>Reset test</button><small class="test-mint-note" role="status" aria-live="polite"></small>';
  host.append(panel);
  const toggle = panel.querySelector('.test-mint-toggle');
  const reset = panel.querySelector('.test-mint-reset');
  const note = panel.querySelector('.test-mint-note');
  const controls = document.createElement('details');
  controls.className = 'test-evolution';
  controls.hidden = true;
  controls.innerHTML = '<summary>Test milestones &amp; evolution</summary><div class="test-evolution-body"><output class="test-cap-reading"></output><label>Simulated market cap <input class="test-cap-slider" aria-label="Simulated market cap" type="range" min="3" max="9" step=".001" value="4"></label><div class="test-milestones" role="group" aria-label="Market-cap presets"></div><label>Movement <select class="test-direction" aria-label="Simulated price direction"><option value="up">Up 20%</option><option value="down">Down 20%</option></select></label><label><input class="test-activity" type="checkbox" checked> Sample trades · hear quiet coins</label><div><button type="button" class="test-cap-real">Use real market</button><button type="button" class="test-cap-restart">Restart at $10K</button></div><small class="test-stage-reading" role="status"></small><small>Engine simulation only. Chart, prices and saved history stay real. Press Listen to hear; musical changes follow phrase boundaries.</small></div>';
  panel.append(controls);
  const slider = controls.querySelector('.test-cap-slider');
  const reading = controls.querySelector('.test-cap-reading');
  const stageReading = controls.querySelector('.test-stage-reading');
  const direction = controls.querySelector('.test-direction');
  const activity = controls.querySelector('.test-activity');
  const presets = controls.querySelector('.test-milestones');
  const exportHost = document.createElement('div');
  exportHost.className = 'test-nft-export';
  controls.querySelector('.test-evolution-body').append(exportHost);
  const dollars = value => '$' + Number(value).toLocaleString('en', {maximumFractionDigits: 0});
  const compact = value => value >= 1e9 ? '$1B' : value >= 1e6 ? '$' + value / 1e6 + 'M' : '$' + value / 1000 + 'K';
  const presetButtons = TEST_CAPS.map(cap => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = compact(cap);
    button.addEventListener('click', () => selectCap(cap));
    presets.append(button); return {cap, button};
  });
  let evolution = {};
  try {
    const saved = JSON.parse(storage?.getItem(EVOLUTION_KEY) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      evolution = Object.fromEntries(Object.entries(saved).filter(([key, value]) => key.length < 300 && value && typeof value === 'object').slice(-100).map(([key, value]) => [key, {
        cap: validTestCap(value.cap), referenceCap: validTestCap(value.referenceCap), highestCap: validTestCap(value.highestCap),
        sampleActivity: value.sampleActivity !== false, direction: value.direction === 'down' ? 'down' : 'up',
      }]));
    }
  } catch {}
  let records = {};
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      records = Object.fromEntries(Object.entries(saved).filter(([key, value]) => key.length < 300 && typeof value === 'boolean').slice(-100));
    }
  } catch {}
  let coin = null, playing = false, elapsed = 0, startedAt = null, timer = null, locked = false;
  const tested = () => coin && Object.hasOwn(records, coin.key);
  const minted = () => tested() && records[coin.key] === true;
  const settings = () => coin ? evolution[coin.key] : null;
  const simulation = () => minted() && validTestCap(settings()?.cap) !== null ? {...settings(), coinKey: coin.key} : null;
  function save() {
    records = Object.fromEntries(Object.entries(records).slice(-100));
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(records)); } catch {}
    evolution = Object.fromEntries(Object.entries(evolution).slice(-100));
    try { storage?.setItem(EVOLUTION_KEY, JSON.stringify(evolution)); } catch {}
  }
  function clearTimer() { clearTimeout(timer); timer = null; }
  function accountTime() {
    if (playing && startedAt !== null) elapsed += Math.max(0, now() - startedAt);
    startedAt = null;
  }
  function arm() {
    clearTimer();
    if (!playing || !tested() || minted()) return;
    startedAt = now();
    timer = setTimeout(() => {
      accountTime();
      timer = null;
      note.textContent = 'Preview ended · test mint ON for continuous playback.';
      onPreviewEnd?.();
    }, Math.max(0, PREVIEW_MS - elapsed));
  }
  function render() {
    toggle.disabled = locked || !coin;
    reset.disabled = locked;
    for (const input of [slider, direction, activity, ...presetButtons.map(p => p.button),
      controls.querySelector('.test-cap-real'), controls.querySelector('.test-cap-restart')]) input.disabled = locked;
    toggle.setAttribute('aria-checked', String(Boolean(minted())));
    toggle.textContent = tested() ? 'Test mint · ' + (minted() ? 'ON' : 'OFF') : 'Test mint';
    toggle.title = coin ? 'Simulate minting for ' + coin.name + ' in this browser' : 'Load a coin first';
    reset.hidden = !tested();
    panel.dataset.state = !tested() ? 'normal' : minted() ? 'minted' : 'preview';
    const sim = simulation();
    note.textContent = !tested() ? '' : minted() ? sim ? 'SIMULATED · ' + dollars(sim.cap) + (sim.sampleActivity ? ' · sample trades' : ' · observed activity') : 'TEST · continuous playback · open milestones to simulate growth' : 'TEST · 20-second preview · saved on this device';
    controls.hidden = !minted();
    reading.textContent = sim ? 'Simulated cap ' + dollars(sim.cap) : 'Real market inputs · choose a milestone to simulate';
    if (sim) slider.value = String(Math.log10(sim.cap));
    activity.checked = settings()?.sampleActivity !== false;
    direction.value = settings()?.direction || 'up';
    const highest = sim ? Math.max(sim.cap, sim.highestCap || 0) : 0;
    stageReading.textContent = sim ? 'Highest tested: ' + dollars(highest) + ' · ' + testStage(highest) + '/' + TEST_MILESTONES.length + ' milestones reached. ' + (sim.cap >= 1e8 ? 'Artwork colour mapping · requires a loaded coin image.' : sim.cap >= 1e7 ? 'Coin image attraction grows towards $50M.' : 'Choose $1M+ to compare rhythmic phrasing.') : '';
    for (const {cap, button} of presetButtons) {
      button.setAttribute('aria-pressed', String(sim?.cap === cap));
      button.dataset.reached = String(Boolean(sim && highest >= cap));
    }
  }
  function publish() {
    panel.dispatchEvent(new CustomEvent('upic:test-mint-change', {bubbles: true, detail: {coinKey: coin?.key, simulated: true, enabled: Boolean(tested()), minted: Boolean(minted())}}));
    onChange?.(simulation());
  }
  function selectCap(value, restart = false) {
    const cap = validTestCap(value);
    if (locked || !minted() || cap === null) return;
    const previous = settings();
    evolution[coin.key] = {sampleActivity: true, direction: 'up', ...previous, cap,
      referenceCap: restart ? cap : previous?.referenceCap || cap,
      highestCap: restart ? cap : Math.max(cap, previous?.highestCap || 0)};
    save(); render(); publish();
  }
  slider.addEventListener('input', () => selectCap(Math.round(10 ** Number(slider.value))));
  direction.addEventListener('change', () => {
    if (locked || !minted()) return;
    const value = direction.value;
    if (!settings()?.cap) selectCap(10_000);
    evolution[coin.key].direction = value === 'down' ? 'down' : 'up';
    save(); render(); publish();
  });
  activity.addEventListener('change', () => {
    if (locked || !minted()) return;
    const checked = activity.checked;
    if (!settings()?.cap) selectCap(10_000);
    evolution[coin.key].sampleActivity = checked;
    save(); render(); publish();
  });
  controls.querySelector('.test-cap-real').addEventListener('click', () => {
    if (locked || !coin) return;
    delete evolution[coin.key]; save(); render(); publish();
  });
  controls.querySelector('.test-cap-restart').addEventListener('click', () => selectCap(10_000, true));
  toggle.addEventListener('click', () => {
    if (locked || !coin) return;
    accountTime();
    records[coin.key] = !minted();
    elapsed = 0;
    save(); render(); publish(); arm();
  });
  reset.addEventListener('click', () => {
    if (locked || !coin) return;
    accountTime(); clearTimer();
    delete records[coin.key];
    delete evolution[coin.key];
    elapsed = 0;
    save(); render(); publish();
  });
  render();
  return {
    exportHost,
    setLocked(value) {locked = Boolean(value); render();},
    simulation,
    setMarket(value) {
      if (value?.key === coin?.key) return;
      accountTime(); clearTimer();
      coin = value;
      elapsed = 0;
      render(); publish(); arm();
    },
    setPlaying(value) {
      if (playing === Boolean(value)) return;
      accountTime();
      playing = Boolean(value);
      if (playing && elapsed >= PREVIEW_MS) elapsed = 0;
      if (playing) render();
      arm();
    },
  };
}
