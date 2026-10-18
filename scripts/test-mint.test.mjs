import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTestMint} from '../apps/web/public/test-mint.js';
import {TEST_MILESTONES, testStage, testEvolutionMetrics, testActivityEvent} from '../apps/web/public/test-evolution.js';
import {earthboundMarketState} from '../apps/web/public/upic-earthbound-visual.js';
import {composeMarketBar} from '../apps/web/public/market-composition.js';

test('test caps reach the real visual and musical mappings without rewriting observed data', async () => {
  const observed = {fresh: 0, snapshotFresh: 0, raw: {motion: 0, activity: 0, volume: 0},
    context: {latestCap: 321}, music: {group: 'up'}, replay: {price: 2}, observation: {liquidity: 12_000}};
  const before = JSON.stringify(observed);
  const small = testEvolutionMetrics(observed, {cap: 10_000, sampleActivity: true});
  const large = testEvolutionMetrics(observed, {cap: 1_000_000, sampleActivity: true});
  const billion = testEvolutionMetrics(observed, {cap: 1_000_000_000, sampleActivity: true});
  assert.equal(earthboundMarketState(large, 'coin').marketCap, 1_000_000);
  assert.equal(earthboundMarketState(billion, 'coin').marketCap, 1_000_000_000);
  assert.equal(large.testMint.original, observed);
  assert.equal(large.replay, undefined, 'simulated performance uses its own clock');
  assert.equal(JSON.stringify(observed), before, 'recorded real prices and history are untouched');
  assert.ok(small.music.tempo < large.music.tempo);
  const plan = m => composeMarketBar(1917, 0, {cap: m.context.latestCap, active: true, music: m.music}).events;
  assert.notDeepEqual(plan(small), plan(large), 'million-cap rhythmic phrasing really changes');
  assert.equal(testEvolutionMetrics(observed, null), observed);
  assert.equal(testEvolutionMetrics(observed, {cap: NaN}), observed);
  assert.equal(testEvolutionMetrics(observed, {cap: 10_000, sampleActivity: false}).fresh, 0);
  assert.equal(testEvolutionMetrics(observed, {cap: 10_000, direction: 'down'}).music.group, 'down');
  const event = testActivityEvent('coin', 10_000, 4, 123, 'down');
  assert.equal(event.simulated, true); assert.equal(event.side, 'sell');
  assert.deepEqual(event, testActivityEvent('coin', 10_000, 4, 123, 'down'));
  const domain = await readFile(new URL('../packages/domain/src/index.ts', import.meta.url), 'utf8');
  const values = domain.match(/THRESHOLDS = \[([^\]]+)\]/)[1].match(/[\d_]+n/g).map(n => Number(n.replace(/[_n]/g, '')));
  assert.deepEqual(TEST_MILESTONES, values, 'test buttons match the platform milestone configuration');
  assert.equal(testStage(99_999), 0); assert.equal(testStage(100_000), 1); assert.equal(testStage(50_000_000), 8);
});

test('controls isolate coins, restore real mode, retain highest tested milestone and keep preview timing', t => {
  class Element {
    handlers = {}; nodes = {}; children = []; dataset = {}; attributes = {}; hidden = false; textContent = '';
    setAttribute(k, v) { this.attributes[k] = v; }
    addEventListener(k, fn) { this.handlers[k] = fn; }
    dispatchEvent() {}
    append(value) { this.children.push(value); }
    querySelector(s) { return this.nodes[s] ??= new Element(); }
    click() { this.handlers.click?.(); }
  }
  const original = {document: globalThis.document, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout};
  t.after(() => Object.assign(globalThis, original));
  globalThis.document = {head: new Element(), createElement: () => new Element()};
  const timers = new Map(), saved = new Map(); let time = 0, id = 0, expired = 0;
  globalThis.setTimeout = (fn, ms) => { const key = ++id; timers.set(key, {ms, fn: () => {timers.delete(key); fn();}}); return key; };
  globalThis.clearTimeout = key => timers.delete(key);
  const storage = {getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value)};
  const host = new Element(), control = createTestMint(host, {storage, now: () => time, onPreviewEnd: () => expired++});
  const panel = host.children[0], button = panel.querySelector('.test-mint-toggle');
  const controls = panel.children[0], presets = controls.querySelector('.test-milestones');
  const preset = name => presets.children.find(b => b.textContent === name);
  control.setMarket({key: 'ethereum:a', name: 'A'}); control.setPlaying(true);
  assert.equal(timers.size, 0);
  button.click(); preset('$1M').click();
  assert.equal(control.simulation().cap, 1_000_000);
  control.setLocked(true); preset('$100K').click(); button.click();
  assert.equal(control.simulation().cap, 1_000_000, 'recording locks cap and test-mint changes');
  control.setLocked(false);
  preset('$100K').click(); assert.equal(control.simulation().highestCap, 1_000_000);
  const direction = controls.querySelector('.test-direction'); direction.value = 'down'; direction.handlers.change();
  assert.equal(control.simulation().direction, 'down');
  control.setMarket({key: 'solana:b', name: 'B'}); assert.equal(control.simulation(), null);
  control.setMarket({key: 'ethereum:a', name: 'A'}); assert.equal(control.simulation().cap, 100_000);
  controls.querySelector('.test-cap-real').click(); assert.equal(control.simulation(), null);
  direction.value = 'down'; direction.handlers.change(); assert.equal(control.simulation().direction, 'down', 'first direction selection survives panel render');
  controls.querySelector('.test-cap-restart').click(); assert.equal(control.simulation().highestCap, 10_000);
  button.click(); assert.equal(control.simulation(), null); assert.equal([...timers.values()][0].ms, 20_000);
  time = 8_000; control.setPlaying(false); assert.equal(timers.size, 0);
  control.setPlaying(true); assert.equal([...timers.values()][0].ms, 12_000);
  time = 20_000; [...timers.values()][0].fn(); assert.equal(expired, 1);
  control.setPlaying(false); panel.querySelector('.test-mint-reset').click(); assert.equal(timers.size, 0);
  button.click(); assert.equal(control.simulation(), null, 'reset also forgets test cap');
  preset('$100M').click();
  const restored = createTestMint(new Element(), {storage});
  restored.setMarket({key: 'ethereum:a', name: 'A'}); assert.equal(restored.simulation().cap, 100_000_000);
});
