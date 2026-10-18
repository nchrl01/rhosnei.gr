const STORAGE_KEY = 'upic:test-mints:v1';
const PREVIEW_MS = 20_000;

// Browser-only playback simulation. Never supplies collection or wallet proofs.
export function createTestMint(host, {onPreviewEnd, storage, now = () => performance.now()} = {}) {
  try { storage ??= globalThis.localStorage; } catch {}
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('./test-mint.css?v=1', import.meta.url).href;
  document.head.append(style);
  const panel = document.createElement('div');
  panel.className = 'test-mint';
  panel.innerHTML = '<button type="button" class="test-mint-toggle" role="switch" aria-checked="false" disabled>Test mint</button><button type="button" class="test-mint-reset" hidden>Reset test</button><small class="test-mint-note" role="status" aria-live="polite"></small>';
  host.append(panel);
  const toggle = panel.querySelector('.test-mint-toggle');
  const reset = panel.querySelector('.test-mint-reset');
  const note = panel.querySelector('.test-mint-note');
  let records = {};
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      records = Object.fromEntries(Object.entries(saved).filter(([key, value]) => key.length < 300 && typeof value === 'boolean').slice(-100));
    }
  } catch {}
  let coin = null, playing = false, elapsed = 0, startedAt = null, timer = null;
  const tested = () => coin && Object.hasOwn(records, coin.key);
  const minted = () => tested() && records[coin.key] === true;
  function save() {
    records = Object.fromEntries(Object.entries(records).slice(-100));
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(records)); } catch {}
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
    toggle.disabled = !coin;
    toggle.setAttribute('aria-checked', String(Boolean(minted())));
    toggle.textContent = tested() ? 'Test mint · ' + (minted() ? 'ON' : 'OFF') : 'Test mint';
    toggle.title = coin ? 'Simulate minting for ' + coin.name + ' in this browser' : 'Load a coin first';
    reset.hidden = !tested();
    panel.dataset.state = !tested() ? 'normal' : minted() ? 'minted' : 'preview';
    note.textContent = !tested() ? '' : minted() ? 'TEST · continuous playback · saved on this device' : 'TEST · 20-second preview · saved on this device';
  }
  function publish() {
    panel.dispatchEvent(new CustomEvent('upic:test-mint-change', {bubbles: true, detail: {coinKey: coin?.key, simulated: true, enabled: Boolean(tested()), minted: Boolean(minted())}}));
  }
  toggle.addEventListener('click', () => {
    if (!coin) return;
    accountTime();
    records[coin.key] = !minted();
    elapsed = 0;
    save(); render(); publish(); arm();
  });
  reset.addEventListener('click', () => {
    if (!coin) return;
    accountTime(); clearTimer();
    delete records[coin.key];
    elapsed = 0;
    save(); render(); publish();
  });
  render();
  return {
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
