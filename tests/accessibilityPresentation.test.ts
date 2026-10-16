import { describe, expect, it } from 'vitest';
import { accessiblePresentationIntensity, finalChaseAmbienceGain, genericScareCameraKick, stalkerHuntScale } from '../src/game/accessibilityPresentation';

describe('reduced horror presentation intensity', () => {
  it('reduces visual effect intensity and camera kick without disabling the event', () => {
    expect(accessiblePresentationIntensity(0.8, false)).toBe(0.8);
    expect(accessiblePresentationIntensity(0.8, true)).toBeCloseTo(0.448);
    const standard = genericScareCameraKick(false);
    const reduced = genericScareCameraKick(true);
    expect(reduced.durationMs).toBeLessThan(standard.durationMs);
    expect(reduced.intensity).toBeLessThan(standard.intensity);
    expect(accessiblePresentationIntensity(0.8, true)).toBeGreaterThan(0);
    expect(stalkerHuntScale(true, true)).toBeLessThan(stalkerHuntScale(false, true));
    expect(stalkerHuntScale(true, false)).toBeGreaterThan(1);
    expect(finalChaseAmbienceGain(true)).toBeGreaterThan(finalChaseAmbienceGain(false));
    expect(finalChaseAmbienceGain(false)).toBe(0.46);
    expect(finalChaseAmbienceGain(true)).toBe(0.68);
  });
});
