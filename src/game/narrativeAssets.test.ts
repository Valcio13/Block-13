import { describe, expect, it } from 'vitest';
import { NARRATIVE_ASSET_MANIFEST, OPENING_CINEMATIC, OPENING_CINEMATIC_DURATION_MS, shouldPlayOpeningCinematic } from './narrativeAssets';

describe('Floor 13 opening cinematic assets', () => {
  it('registers five authored 320x180 plates and a short-cut 8.5-second sequence', () => {
    const scenes = OPENING_CINEMATIC.map(scene => scene.texture);
    expect(scenes).toEqual(['opening_arrival', 'opening_message', 'opening_entering', 'opening_ascending', 'opening_floor4']);
    for (const key of scenes) {
      const asset = Object.values(NARRATIVE_ASSET_MANIFEST).find(entry => entry.key === key);
      expect(asset).toMatchObject({ width: 320, height: 180 });
      expect(asset?.path).toContain('sprites/narrative/floor13-opening/');
    }
    expect(OPENING_CINEMATIC_DURATION_MS).toBe(8_500);
    expect(OPENING_CINEMATIC[1].caption).toBe('Fourth floor. You need to see this.');
  });

  it('plays only for a fresh Floor 4 run, never during replay or recovery', () => {
    expect(shouldPlayOpeningCinematic({ floor: 4, tick: 0, replay: false, recovery: false, alreadySeen: false })).toBe(true);
    expect(shouldPlayOpeningCinematic({ floor: 4, tick: 0, replay: true, recovery: false, alreadySeen: false })).toBe(false);
    expect(shouldPlayOpeningCinematic({ floor: 4, tick: 0, replay: false, recovery: true, alreadySeen: false })).toBe(false);
    expect(shouldPlayOpeningCinematic({ floor: 3, tick: 0, replay: false, recovery: false, alreadySeen: false })).toBe(false);
    expect(shouldPlayOpeningCinematic({ floor: 4, tick: 1, replay: false, recovery: false, alreadySeen: false })).toBe(false);
    expect(shouldPlayOpeningCinematic({ floor: 4, tick: 0, replay: false, recovery: false, alreadySeen: true })).toBe(false);
  });
});
