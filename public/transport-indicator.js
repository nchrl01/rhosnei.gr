/** A small transport lamp. A connected cache is never presented as a live feed. */
export function createTransportIndicator(host) {
  if (!host) throw new Error('Transport indicator needs a host element.');
  const dot = document.createElement('span');
  const label = document.createElement('span');
  dot.className = 'transport-indicator__dot';
  dot.setAttribute('aria-hidden', 'true');
  label.className = 'transport-indicator__label';
  host.classList.add('transport-indicator');
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  host.setAttribute('aria-atomic', 'true');
  host.replaceChildren(dot, label);
  let previous = '', hasPlayed = false;

  function render({playing = false, audioRunning = false, replay = false,
    seeking = false, ended = false, streamConnected = false,
    streamKind = 'snapshot', fresh = 0} = {}) {
    let text, kind = 'idle', pulse = false, detail;
    const running = playing && audioRunning;
    if (playing) hasPlayed = true;
    if (replay) {
      if (ended) {
        text = 'REPLAY ENDED';
        detail = 'The loaded historical score has finished.';
      } else if (seeking) {
        text = 'SEEKING';
        kind = 'replay';
        detail = 'Choosing a point in the loaded history; sound is held while seeking.';
      } else if (running) {
        text = 'PLAYBACK';
        kind = 'replay';
        pulse = true;
        detail = 'Playing the loaded historical score; this is not current market activity.';
      } else {
        text = playing ? 'AUDIO PAUSED' : 'PAUSED';
        detail = playing ? 'Audio is interrupted. Tap Listen to resume historical playback.' : 'Historical playback is paused.';
      }
    } else if (!running) {
      text = playing ? 'AUDIO PAUSED' : hasPlayed ? 'PAUSED' : 'READY';
      detail = playing ? 'Audio is interrupted. Tap Listen to resume.' : hasPlayed ? 'Playback is paused. Tap Listen to resume the selected market.' : 'Tap Listen to hear the selected market.';
    } else if (streamConnected && (streamKind === 'swap' || streamKind === 'rpc-poll' || streamKind === 'exchange')) {
      text = 'LIVE NOW';
      kind = 'live';
      pulse = true;
      detail = streamKind === 'exchange' ? 'Receiving public exchange trades over WebSocket.' : streamKind === 'rpc-poll' ? 'Listening to directly observed chain activity with a polling delay; price conversion and liquidity use snapshots.' : 'Listening to the connected swap stream; price conversion and liquidity use snapshots.';
    } else if (streamConnected && streamKind === 'pool') {
      text = 'ACTIVITY NOW';
      kind = 'live';
      pulse = true;
      detail = 'Listening to connected pool activity. Price, volume and direction still come from market snapshots.';
    } else if (streamConnected && streamKind === 'trade-poll') {
      text = 'CACHED TRADES';
      kind = 'delayed';
      detail = 'Listening to cached trade polling. Provider trades may arrive after the market event.';
    } else if (fresh > 0) {
      text = 'SNAPSHOTS';
      kind = 'delayed';
      detail = 'Listening to periodically refreshed market snapshots; an instant trade stream is not connected.';
    } else {
      text = 'WAITING';
      detail = 'No fresh market source is available. Waiting for the feed to reconnect.';
    }
    const signature = [text, kind, pulse, detail].join('|');
    if (signature === previous) return;
    previous = signature;
    host.dataset.state = kind;
    host.dataset.pulse = pulse ? 'true' : 'false';
    host.title = detail;
    label.textContent = text;
  }
  render();
  return {render};
}
