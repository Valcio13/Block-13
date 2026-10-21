import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTAINER_SCARE_ASSET, CONTAINER_SCARE_VARIANT_ASSETS, ENEMY_ASSET_MANIFEST, CRAWLER_WALK_CYCLE_DURATION_MS, CRAWLER_WALK_FRAME_RATE, LAMP_JUMPSCARE_ASSET, LAMP_JUMPSCARE_VARIANT_ASSETS, MIMIC_REVEAL_PULSE_DURATION_MS, ambusherWarningAlpha, containerScareAssetForSearchIndex, crawlerMovedBetween, crawlerPresentationPhaseOffsetMs, crawlerTextureKeyForPresentation, lampJumpscareAssetForEvent, mimicRevealPulseScale, watcherGazeAudioPosition, watcherGazeEyeAlpha, watcherTextureKey, ambusherTextureKey, mimicTextureKey } from '../src/game/enemyAssets';
import { AuthoritativeSimulation, FIXED_SCALE } from '../src/core/authoritativeSimulation';
import { NARRATIVE_ASSET_MANIFEST, victoryExteriorScale } from '../src/game/narrativeAssets';
import { resultHandoffReady, shouldBeginVictoryEpilogue, VICTORY_EPILOGUE } from '../src/game/contestUx';

function expectPng(asset: { path: string; width: number; height: number }, colorType: number) {
  const png = readFileSync(new URL(`../public${asset.path}`, import.meta.url));
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png.readUInt32BE(16)).toBe(asset.width);
  expect(png.readUInt32BE(20)).toBe(asset.height);
  expect(png[25]).toBe(colorType);
}

describe('remaining authored Block 13 visual assets', () => {
  it('registers all eight transparent creature sprites at their native sizes', () => {
    expect(Object.keys(ENEMY_ASSET_MANIFEST)).toHaveLength(8);
    for (const asset of Object.values(ENEMY_ASSET_MANIFEST)) expectPng(asset, 6);
    expect(ENEMY_ASSET_MANIFEST.forgotten_appearance).toMatchObject({ width: 32, height: 52 });
  });

  it('registers the dedicated container jumpscare image at its authored size', () => {
    expectPng(CONTAINER_SCARE_ASSET, 2);
    expect(CONTAINER_SCARE_VARIANT_ASSETS).toHaveLength(2);
    expectPng(CONTAINER_SCARE_VARIANT_ASSETS[1], 2);
    expect(containerScareAssetForSearchIndex(0).key).toBe('container_jumpscare_nightmare_trunk');
    expect(containerScareAssetForSearchIndex(1).key).toBe('container_jumpscare_clawed_hand');
    expect(containerScareAssetForSearchIndex(2).key).toBe('container_jumpscare_nightmare_trunk');
    expectPng(LAMP_JUMPSCARE_ASSET, 2);
    expect(LAMP_JUMPSCARE_VARIANT_ASSETS).toHaveLength(2);
    expectPng(LAMP_JUMPSCARE_VARIANT_ASSETS[1], 2);
    expect(lampJumpscareAssetForEvent(0).key).toBe('lamp_jumpscare_crawling_shadow');
    expect(lampJumpscareAssetForEvent(1).key).toBe('lamp_jumpscare_ghostly_figure');
  });

  it('runs the Crawler four-step 8 FPS cycle and returns immediately to idle on stop', () => {
    expect(CRAWLER_WALK_FRAME_RATE).toBe(8);
    expect(CRAWLER_WALK_CYCLE_DURATION_MS).toBe(500);
    const exists = () => true;
    expect(crawlerTextureKeyForPresentation(true, 0, exists, 'crawler_9')).toBe('crawler_walk_01');
    expect(crawlerTextureKeyForPresentation(true, 125, exists, 'crawler_9')).toBe('crawler_idle');
    expect(crawlerTextureKeyForPresentation(true, 250, exists, 'crawler_9')).toBe('crawler_walk_02');
    expect(crawlerTextureKeyForPresentation(true, 375, exists, 'crawler_9')).toBe('crawler_idle');
    expect(crawlerTextureKeyForPresentation(false, 375, exists, 'crawler_9')).toBe('crawler_idle');
    expect(crawlerTextureKeyForPresentation(true, 0, key => key === 'crawler_idle', 'crawler_9')).toBe('crawler_idle');
    expect(crawlerTextureKeyForPresentation(false, 0, () => false, 'crawler_9')).toBe('crawler_9');
  });

  it('detects Crawler motion from immutable position snapshots only', () => {
    const before = Object.freeze({ x: 12, y: 20 });
    const after = Object.freeze({ x: 12, y: 21 });
    expect(crawlerMovedBetween(before, after)).toBe(true);
    expect(crawlerMovedBetween(before, before)).toBe(false);
    expect(before).toEqual({ x: 12, y: 20 });
    expect(after).toEqual({ x: 12, y: 21 });
  });

  it('desynchronizes Crawler walk cycles with stable entity-id phase offsets', () => {
    expect(crawlerPresentationPhaseOffsetMs(0)).toBe(0);
    expect(crawlerPresentationPhaseOffsetMs(1)).toBe(125);
    expect(crawlerPresentationPhaseOffsetMs(2)).toBe(250);
    expect(crawlerPresentationPhaseOffsetMs(1)).toBe(crawlerPresentationPhaseOffsetMs(1));
    expect(crawlerTextureKeyForPresentation(true, 0, () => true, 'fallback', crawlerPresentationPhaseOffsetMs(0))).toBe('crawler_walk_01');
    expect(crawlerTextureKeyForPresentation(true, 0, () => true, 'fallback', crawlerPresentationPhaseOffsetMs(1))).toBe('crawler_idle');
    expect(crawlerTextureKeyForPresentation(true, 0, () => true, 'fallback', crawlerPresentationPhaseOffsetMs(2))).toBe('crawler_walk_02');
  });

  it('selects authored Watcher, Ambusher and Mimic art with procedural fallbacks', () => {
    expect(watcherTextureKey(key => key === 'watcher_idle', 'watcher_4')).toBe('watcher_idle');
    expect(watcherTextureKey(() => false, 'watcher_4')).toBe('watcher_4');
    expect(ambusherTextureKey(key => key === 'ambusher_warning', 'ambusher_2')).toBe('ambusher_warning');
    expect(ambusherTextureKey(() => false, 'ambusher_2')).toBe('ambusher_2');
    expect(mimicTextureKey(false, key => key === 'mimic_disguise', 'mimic_1_2')).toBe('mimic_disguise');
    expect(mimicTextureKey(true, key => key === 'mimic_revealed', 'mimic_revealed')).toBe('mimic_revealed');
    expect(mimicTextureKey(false, () => false, 'mimic_1_2')).toBe('mimic_1_2');
  });

  it('limits the Watcher gaze eye cue and Mimic reveal recoil to presentation-only signals', () => {
    expect(watcherGazeEyeAlpha(false, true, 1)).toBe(0);
    expect(watcherGazeEyeAlpha(true, false, 1)).toBe(0);
    expect(watcherGazeEyeAlpha(true, true, 0)).toBe(0.34);
    expect(watcherGazeEyeAlpha(true, true, 1)).toBe(0.78);
    expect(MIMIC_REVEAL_PULSE_DURATION_MS).toBe(300);
    expect(mimicRevealPulseScale(0)).toBe(1.2);
    expect(mimicRevealPulseScale(50)).toBeGreaterThan(1.25);
    expect(mimicRevealPulseScale(150)).toBeLessThan(1.2);
    expect(mimicRevealPulseScale(300)).toBe(1.2);
  });

  it('targets one gaze cue only when an already-active Watcher enters the authoritative gaze cone', () => {
    const base = new AuthoritativeSimulation(903n).state;
    const present = {
      ...base, x: 0, y: 0, facingX: -1, facingY: 0,
      watchers: [{ id: 5, x: 50 * FIXED_SCALE, y: 0, active: true, illuminatedTicks: 0, decayRemainder: 0, curseRemainder: 0 }],
    };
    const looking = { ...present, facingX: 1 };
    expect(watcherGazeAudioPosition(present, looking)).toEqual({ x: 50 * FIXED_SCALE, y: 0 });
    expect(watcherGazeAudioPosition(looking, looking)).toBeUndefined();
    const newlyActive = { ...present, watchers: [{ ...present.watchers[0], active: false }] };
    expect(watcherGazeAudioPosition(newlyActive, looking)).toBeUndefined();
  });

  it('uses a restrained slower breath during the existing Ambusher warning state', () => {
    expect(ambusherWarningAlpha(1, 0, 0)).toBeCloseTo(0.75);
    expect(ambusherWarningAlpha(1, -Math.PI / (2 * 0.08), 0)).toBeCloseTo(0.64);
    expect(ambusherWarningAlpha(0.5, 0, 0)).toBeCloseTo(0.375);
    expect(ambusherWarningAlpha(1, 0, 0)).toBe(ambusherWarningAlpha(1, 0, 0));
  });

  it('registers the opaque 320x180 exterior and scales the 1280x720 tableau by integers', () => {
    const asset = NARRATIVE_ASSET_MANIFEST.victory_exterior_bg;
    expectPng(asset, 2);
    expect(victoryExteriorScale(1280, 720)).toEqual({ x: 4, y: 4 });
  });

  it('retains the existing win-only epilogue and result handoff flow', () => {
    expect(shouldBeginVictoryEpilogue('won')).toBe(true);
    expect(shouldBeginVictoryEpilogue('lost')).toBe(false);
    expect(resultHandoffReady('won', false)).toBe(false);
    expect(resultHandoffReady('won', true)).toBe(true);
    expect(resultHandoffReady('lost', false)).toBe(true);
    expect(VICTORY_EPILOGUE.some(beat => beat.text === '12:13 AM')).toBe(true);
    expect(VICTORY_EPILOGUE.some(beat => beat.text === 'There is no Floor 13.')).toBe(true);
  });
});
