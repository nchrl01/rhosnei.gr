import test from 'node:test';
import assert from 'node:assert/strict';
import {preferredVideoFormat, testNftMetadata} from '../apps/web/public/test-nft-export.js';

test('recorder prefers MP4 and labels a WebM fallback honestly', () => {
  assert.equal(preferredVideoFormat({isTypeSupported: () => true}).extension, 'mp4');
  const webm = preferredVideoFormat({isTypeSupported: mime => mime === 'video/webm;codecs=vp8,opus'});
  assert.equal(webm.extension, 'webm'); assert.equal(webm.mime, 'video/webm;codecs=vp8,opus');
  assert.equal(preferredVideoFormat({isTypeSupported: () => false}), null);
  assert.equal(preferredVideoFormat(null), null);
});

test('download metadata references the actual files and never claims a mint or verified milestone', () => {
  const snapshot = {symbol: 'TEST', stage: 3, chain: 'ethereum', token: '0x123', seed: 1917,
    simulation: {cap: 1_000_000, direction: 'up', sampleActivity: true},
    engine: 'upic-main-instrument-v294', createdAt: '2026-10-18T00:00:00Z'};
  const media = {basename: 'test-coin', extension: 'webm', mime: 'video/webm', duration: 20, videoHash: 'abc', imageHash: 'def'};
  const result = testNftMetadata(snapshot, media);
  assert.equal(result.animation_url, 'test-coin.webm'); assert.equal(result.image, 'test-coin.png');
  assert.equal(result.properties.minted, false); assert.equal(result.properties.verified_milestones, false);
  assert.equal(result.properties.test_only, true); assert.equal(result.properties.frozen_input, snapshot);
  assert.equal(result.properties.video.type, 'video/webm'); assert.equal(result.properties.video.sha256, 'abc');
  assert.equal(result.properties.cover.sha256, 'def'); assert.equal(result.properties.video.duration_seconds, 20);
  assert.equal(result.properties.video.target_fps, 24); assert.equal(result.properties.video.frame_timing, 'realtime-variable');
  assert.equal(result.properties.capture_mode, 'realtime-main-instrument');
  assert.match(result.description, /no NFT was minted/);
  assert.doesNotMatch(JSON.stringify(result), /ipfs:\/\//);
});
