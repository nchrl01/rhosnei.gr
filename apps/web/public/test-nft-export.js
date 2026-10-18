export const TEST_EXPORT_SECONDS = 20;

export function preferredVideoFormat(Recorder = globalThis.MediaRecorder) {
  if (!Recorder?.isTypeSupported) return null;
  for (const mime of ['video/mp4;codecs=avc1.42001E,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) {
    if (Recorder.isTypeSupported(mime)) return {mime, extension: mime.startsWith('video/mp4') ? 'mp4' : 'webm'};
  }
  return null;
}
const checkAbort = signal => { if (signal?.aborted) throw signal.reason || Error('Export cancelled.'); };
const png = canvas => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('Could not create the cover image.')), 'image/png'));
async function checksum(blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, '0')).join('');
}

export function testNftMetadata(snapshot, {basename, extension, mime, duration, videoHash, imageHash}) {
  return {
    name: snapshot.symbol + ' · UPIC test edition',
    description: 'TEST EXPORT — audiovisual capture from the UPIC main instrument. Simulated market inputs; no NFT was minted and no blockchain milestone is verified.',
    image: basename + '.png', animation_url: basename + '.' + extension,
    attributes: [
      {trait_type: 'Test market cap USD', value: snapshot.simulation.cap},
      {trait_type: 'Highest tested milestone', value: snapshot.stage},
      {trait_type: 'Direction', value: snapshot.simulation.direction},
      {trait_type: 'Source chain', value: snapshot.chain},
    ],
    properties: {test_only: true, minted: false, verified_milestones: false,
      capture_mode: 'realtime-main-instrument', reproducibility: 'Frozen inputs and seed; live audio phase and browser encoding are not byte-identical across exports.',
      engine: snapshot.engine, seed: snapshot.seed, token: snapshot.token, created_at: snapshot.createdAt,
      video: {file: basename + '.' + extension, type: mime, width: 720, height: 720, target_fps: 24, frame_timing: 'realtime-variable', duration_seconds: duration, sha256: videoHash},
      cover: {file: basename + '.png', type: 'image/png', width: 2048, height: 2048, sha256: imageHash},
      audio: {source: 'main-instrument-before-listening-volume', fade_seconds: .12},
      frozen_input: snapshot,
    },
  };
}

// Records only generated canvas frames and the app's audio graph. No screen,
// microphone, camera, wallet or third-party recording service is involved.
export async function recordTestArtwork(prepared, {signal, onProgress = () => {}, seconds = TEST_EXPORT_SECONDS} = {}) {
  const format = preferredVideoFormat();
  if (!format) throw Error('This browser cannot record video. Try a current Safari or Chrome browser.');
  const {visual, context, tap} = prepared;
  let recorder, stream, canvasStream, destination, branch, raf, watchdog;
  try {
    checkAbort(signal);
    onProgress({phase: 'cover', elapsed: 0});
    visual.frame(0, 2048);
    const poster = await png(visual.canvas);
    checkAbort(signal);
    visual.frame(0, 720);
    if (!visual.canvas.captureStream) throw Error('Canvas video export is unavailable in this browser.');
    destination = context.createMediaStreamDestination();
    branch = context.createGain(); branch.gain.value = 0; tap.connect(branch); branch.connect(destination);
    canvasStream = visual.canvas.captureStream(24);
    const audioTracks = destination.stream.getAudioTracks();
    if (!audioTracks.length) throw Error('The player audio could not be attached to the export.');
    stream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
    recorder = new MediaRecorder(stream, {mimeType: format.mime, videoBitsPerSecond: 3_000_000, audioBitsPerSecond: 192_000});
    const chunks = []; let bytes = 0, elapsed = 0;
    await new Promise((resolve, reject) => {
      let settled = false, origin, lastFrame = -1;
      const finish = error => {
        if (settled) return; settled = true;
        signal?.removeEventListener('abort', abort);
        error ? reject(error) : resolve();
      };
      const abort = () => finish(signal.reason || Error('Export cancelled.'));
      signal?.addEventListener('abort', abort, {once: true});
      recorder.ondataavailable = event => {
        if (settled || !event.data.size) return;
        bytes += event.data.size;
        if (bytes > 64 * 1024 * 1024) {finish(Error('Export exceeded its memory limit. Try again in another browser.')); return;}
        chunks.push(event.data);
      };
      recorder.onerror = () => finish(Error('The browser video encoder failed.'));
      recorder.onstop = () => finish(elapsed < seconds - .5 ? Error('Recording stopped before the full clip was captured.') : null);
      recorder.onstart = () => {
        origin = context.currentTime;
        branch.gain.setValueAtTime(0, origin); branch.gain.linearRampToValueAtTime(1, origin + .12);
        branch.gain.setValueAtTime(1, origin + seconds - .12); branch.gain.linearRampToValueAtTime(0, origin + seconds);
        const frame = () => {
          try {
          if (settled) return;
          if (context.state !== 'running') {finish(Error('Audio was interrupted. Keep the player running during export.')); return;}
          elapsed = Math.max(0, context.currentTime - origin);
          const number = Math.floor(Math.min(seconds, elapsed) * 24);
          if (number !== lastFrame) {lastFrame = number; visual.frame(Math.min(seconds, elapsed), 720);}
          onProgress({phase: 'recording', elapsed: Math.min(seconds, elapsed)});
          if (elapsed >= seconds) {recorder.stop(); return;}
          raf = requestAnimationFrame(frame);
          } catch (error) {finish(error instanceof Error ? error : Error('The artwork renderer failed.'));}
        };
        frame();
      };
      watchdog = setTimeout(() => finish(Error('Export timed out. Keep this tab visible while recording.')), (seconds + 10) * 1000);
      checkAbort(signal);
      recorder.start(500);
    });
    checkAbort(signal);
    const mime = recorder.mimeType || format.mime;
    const extension = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    const video = new Blob(chunks, {type: mime});
    if (!video.size) throw Error('The browser returned an empty video.');
    return {poster, video, mime, extension, duration: seconds};
  } finally {
    clearTimeout(watchdog); cancelAnimationFrame(raf);
    if (recorder && recorder.state !== 'inactive') {try {recorder.stop();} catch {}}
    for (const track of new Set([...(stream?.getTracks() || []), ...(canvasStream?.getTracks() || []), ...(destination?.stream.getTracks() || [])])) track.stop();
    if (branch) {try {tap.disconnect(branch);} catch {} branch.disconnect();}
  }
}

export function createTestNftExporter(host, {prepare, enabled, onBusy = () => {}}) {
  host.innerHTML = '<div class="test-export-actions"><button type="button" class="test-export-start">Export test NFT</button><button type="button" class="test-export-cancel" hidden>Cancel export</button></div><small class="test-export-status" role="status" aria-live="polite"></small><div class="test-export-files"></div>';
  const button = host.querySelector('.test-export-start'), cancel = host.querySelector('.test-export-cancel');
  const status = host.querySelector('.test-export-status'), files = host.querySelector('.test-export-files');
  let controller = null, busy = false, urls = [];
  function refresh(preserveStatus = false) {
    button.disabled = busy || !enabled();
    cancel.hidden = !busy;
    if (preserveStatus) return;
    if (!busy && !enabled()) status.textContent = 'Choose a test cap and enable sample trades to export.';
    else if (!busy && !files.childElementCount) status.textContent = '20 seconds · artwork and sound only · files stay on your device.';
  }
  function link(blob, label, filename) {
    const url = URL.createObjectURL(blob); urls.push(url);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.textContent = label; files.append(a); return url;
  }
  function abort(reason = 'Export cancelled.') {controller?.abort(Error(reason));}
  cancel.onclick = () => abort();
  button.onclick = async () => {
    if (busy || !enabled()) return;
    const active = new AbortController(); controller = active; busy = true; onBusy(true); refresh();
    let prepared;
    const hidden = () => {if (document.hidden) abort('Export cancelled because the tab was hidden. Keep it visible for the full 20 seconds.');};
    document.addEventListener('visibilitychange', hidden);
    try {
      if (!preferredVideoFormat()) throw Error('Video recording is unavailable in this browser.');
      status.textContent = 'Preparing the main player…';
      prepared = await prepare(active.signal);
      checkAbort(active.signal);
      let lastSecond = -1;
      const result = await recordTestArtwork(prepared, {signal: active.signal, onProgress: ({phase, elapsed}) => {
        const second = Math.floor(elapsed);
        if (phase === 'cover') status.textContent = 'Rendering the 2048px cover…';
        else if (second !== lastSecond) {lastSecond = second; status.textContent = 'Exporting ' + second + ' / 20 seconds · keep this tab visible';}
      }});
      status.textContent = 'Preparing downloads…';
      const symbol = (prepared.snapshot.symbol || 'coin').replace(/[^a-z0-9_-]/gi, '').slice(0, 30) || 'coin';
      const basename = 'upic-test-' + symbol + '-' + prepared.snapshot.simulation.cap + '-' + Date.now();
      const [videoHash, imageHash] = await Promise.all([checksum(result.video), checksum(result.poster)]);
      checkAbort(active.signal);
      const metadata = testNftMetadata(prepared.snapshot, {...result, basename, videoHash, imageHash});
      for (const url of urls) URL.revokeObjectURL(url); urls = []; files.replaceChildren();
      const videoURL = link(result.video, 'Download ' + result.extension.toUpperCase(), basename + '.' + result.extension);
      link(result.poster, 'Download cover PNG', basename + '.png');
      link(new Blob([JSON.stringify(metadata, null, 2)], {type: 'application/json'}), 'Download metadata', basename + '.json');
      const details = document.createElement('details'), summary = document.createElement('summary'), video = document.createElement('video');
      summary.textContent = 'Preview exported clip'; video.controls = true; video.playsInline = true; video.preload = 'metadata'; video.src = videoURL;
      details.append(summary, video); files.append(details);
      status.textContent = result.extension === 'mp4' ? 'Test export ready · no mint or upload.' : 'Test export ready as WebM. This browser does not provide MP4 recording.';
    } catch (error) {
      status.textContent = error.message || 'Export failed. Please try again.';
    } finally {
      document.removeEventListener('visibilitychange', hidden);
      try {prepared?.visual.close();} finally {
        try {await prepared?.restore?.();} finally {busy = false; controller = null; onBusy(false); refresh(true);}
      }
    }
  };
  refresh();
  return {refresh, cancel: abort, get busy() {return busy;}};
}
