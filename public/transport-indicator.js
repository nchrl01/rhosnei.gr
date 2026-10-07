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
        detail = 'Replay finished.';
      } else if (seeking) {
        text = 'SEEKING';
        kind = 'replay';
        detail = 'Choose where to replay.';
      } else if (running) {
        text = 'PLAYBACK';
        kind = 'replay';
        pulse = true;
        detail = 'Replaying this market’s history.';
      } else {
        text = playing ? 'AUDIO PAUSED' : 'PAUSED';
        detail = playing ? 'Tap Resume to continue the replay.' : 'Replay paused.';
      }
    } else if (!running) {
      text = playing ? 'AUDIO PAUSED' : hasPlayed ? 'PAUSED' : 'READY';
      detail = playing ? 'Tap Resume to continue.' : hasPlayed ? 'Tap Listen to resume.' : 'Tap Listen to hear this market.';
    } else if (streamConnected && (streamKind === 'swap' || streamKind === 'rpc-poll' || streamKind === 'exchange')) {
      text = 'LIVE NOW';
      kind = 'live';
      pulse = true;
      detail = streamKind === 'exchange' ? 'Following current trades.' : streamKind === 'rpc-poll' ? 'Following trades · updates may be delayed.' : 'Following current trades.';
    } else if (streamConnected && streamKind === 'pool') {
      text = 'ACTIVITY NOW';
      kind = 'live';
      pulse = true;
      detail = 'Following activity · prices update periodically.';
    } else if (streamConnected && streamKind === 'trade-poll') {
      text = 'CACHED TRADES';
      kind = 'delayed';
      detail = 'Trade updates may be delayed.';
    } else if (fresh > 0) {
      text = 'SNAPSHOTS';
      kind = 'delayed';
      detail = 'Prices update periodically.';
    } else {
      text = 'WAITING';
      detail = 'Waiting for market updates.';
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
