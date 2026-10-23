// A short, causal memory for expression. These are raw score-bar snapshots,
// not previously blended values. Replay can reconstruct them in any seek order.
// Tempo, key, market direction and activity gates always remain current.
export function compositionContext(current, previous = []) {
 if (!current || current.active === false) return current;
 const history = [current];
 for (const row of previous.slice(0, 3)) {
  if (!row || row.active === false) break;
  history.push(row);
 }
 const music = { ...current.music };
 const average = values => {
  const weights = values.map((_, i) => 4 - i);
  return values.reduce((sum, value, i) => sum + value * weights[i], 0) / weights.reduce((a, b) => a + b, 0);
 };
 for (const key of ['intensity', 'activity']) {
  if (!Number.isFinite(music[key])) continue;
  const values = [];
  for (const row of history) {
   const value = row.music?.[key];
   if (!Number.isFinite(value)) break;
   values.push(Math.max(0, Math.min(1, value)));
  }
  music[key] = average(values);
 }
 // The logarithmic blend suits market-cap scale. Missing observations stay
 // missing; this is a musical control, never a replacement for the readout.
 let cap = current.cap;
 if (Number.isFinite(cap) && cap > 0) {
  const values = [];
  for (const row of history) {
   if (!Number.isFinite(row.cap) || row.cap <= 0) break;
   values.push(Math.log(row.cap));
  }
  if (values.some(value => value !== values[0])) cap = Math.exp(average(values));
 }
 return { ...current, music, cap };
}
