import {musicContext} from '../../apps/web/public/music-context.js?v=208';

// Matches the absolute USD milestones currently defined in @upic/domain.
export const TEST_MILESTONES = [100_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000];
export const TEST_CAPS = [10_000, ...TEST_MILESTONES, 100_000_000, 1_000_000_000];
export const testStage = cap => TEST_MILESTONES.filter(value => Number(cap) >= value).length;
export function validTestCap(value) {
  const cap = Number(value);
  return Number.isFinite(cap) && cap >= 1_000 && cap <= 1_000_000_000 ? cap : null;
}

// An isolated performance input: never put this result into chart history,
// provider caches, mint authorizations or blockchain verification.
export function testEvolutionMetrics(observed, settings) {
  const cap = validTestCap(settings?.cap);
  if (cap === null) return observed;
  const sample = settings.sampleActivity === true;
  const change = settings.direction === 'down' ? -20 : 20;
  const fresh = sample ? 1 : observed.fresh;
  const music = musicContext({price: cap, cap, changes: {m5: change}, fresh,
    moodMovement: {available: true, group: change < 0 ? 'down' : 'up', changePct: change, referenceCap: cap / (1 + change / 100)}});
  const raw = sample ? {motion: .45, activity: .65, volume: .55} : {...observed.raw};
  return {...observed, ...raw, raw, music, replay: undefined,
    fresh, snapshotFresh: sample ? 1 : observed.snapshotFresh,
    tradingActivity: sample ? 1 : observed.tradingActivity,
    pressure: music.intensity,
    context: {...observed.context, latestCap: cap, pressure: music.intensity,
      impliedBaselineCap: settings.referenceCap || cap, ratio: cap / (settings.referenceCap || cap), direction: Math.sign(change)},
    testMint: {simulated: true, sampleActivity: sample, cap, highestCap: Math.max(cap, settings.highestCap || cap),
      stage: testStage(Math.max(cap, settings.highestCap || cap)), original: observed}};
}

export function testActivityEvent(coinKey, cap, index, at, direction = 'up') {
  return {id: 'test-mint:' + coinKey + ':' + index, kind: 'swap', source: 'test-mint', simulated: true,
    side: direction === 'down' ? 'sell' : 'buy', receivedAt: at, occurredAt: at,
    // Virtual units are used only by the phrase selector, never the chart.
    priceUsd: cap * (1 + .002 * Math.sin(index * .4)), usdVolume: 250};
}
