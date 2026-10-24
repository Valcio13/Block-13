import { describe, expect, it } from 'vitest';
import { environmentalLightBrightness, environmentalLightProfile } from '../src/game/proceduralLighting';

describe('procedural environmental lighting', () => {
  it('assigns stable profiles from floor, fixture, and cosmetic seed only', () => {
    const first = environmentalLightProfile(2, 4, 0x12345678);
    expect(environmentalLightProfile(2, 4, 0x12345678)).toEqual(first);
    expect(environmentalLightProfile(2, 5, 0x12345678)).not.toEqual(first);
    expect(['stable', 'dim', 'flickering', 'failing', 'broken']).toContain(first.type);
  });

  it('keeps brightness deterministic and bounded', () => {
    for (const floor of [4, 3, 2, 1, 0]) {
      for (let fixture = 0; fixture < 12; fixture++) {
        const profile = environmentalLightProfile(floor, fixture, 0xfeedcafe);
        for (const tick of [0, 1, 30, 300, 900]) {
          const value = environmentalLightBrightness(profile, tick);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
          expect(environmentalLightBrightness(profile, tick)).toBe(value);
        }
        if (profile.type === 'broken') expect(environmentalLightBrightness(profile, 900)).toBe(0);
        if (profile.type === 'stable' || profile.type === 'dim') {
          expect(environmentalLightBrightness(profile, 0)).toBe(environmentalLightBrightness(profile, 900));
        }
      }
    }
  });

  it('produces floor-specific variety without touching authoritative state', () => {
    for (const floor of [4, 3, 2, 1, 0]) {
      const types = new Set(Array.from({ length: 80 }, (_, fixture) => environmentalLightProfile(floor, fixture, 42).type));
      expect(types.size).toBeGreaterThan(1);
    }
  });
});
