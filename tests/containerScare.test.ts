import { describe, expect, it } from 'vitest';
import { AuthoritativeSimulation } from '../src/core/authoritativeSimulation';
import { containerScareSearchIndex, containerScareShouldPlay, containerScareStyle } from '../src/game/containerScare';
import { accessiblePresentationIntensity } from '../src/game/accessibilityPresentation';

describe('container scare presentation adapter', () => {
  it('fires only when the authoritative scare marker advances on a searched container', () => {
    const previous = { lastTriggerTick: 10, lastType: 2, availableTypes: [0, 1, 2, 3] };
    const current = { lastTriggerTick: 30, lastType: 1, availableTypes: [0, 1, 2, 3] };
    expect(containerScareSearchIndex(previous, current, [4])).toBe(4);
    expect(containerScareSearchIndex(current, current, [4])).toBeNull();
    expect(containerScareSearchIndex(previous, current, [])).toBeNull();
  });

  it('never overlaps an Ambusher scare or presents outside active gameplay', () => {
    expect(containerScareShouldPlay(true, false, true)).toBe(true);
    expect(containerScareShouldPlay(true, true, true)).toBe(false);
    expect(containerScareShouldPlay(true, false, false)).toBe(false);
  });

  it('respects reduced intensity and does not alter authoritative simulation or RNG', () => {
    const sim = new AuthoritativeSimulation(112233n);
    const comparison = new AuthoritativeSimulation(112233n);
    const before = sim.snapshot();
    const full = containerScareStyle(false);
    const reduced = containerScareStyle(true);
    expect(reduced.durationMs).toBeLessThan(full.durationMs);
    expect(reduced.peakAlpha).toBeLessThan(full.peakAlpha);
    expect(reduced.peakScale).toBeLessThan(full.peakScale);
    expect(accessiblePresentationIntensity(0.8, true)).toBeGreaterThan(0);
    expect(sim.snapshot()).toEqual(before);
    const neutral = { left: false, right: false, up: false, down: false, flashlight: false, interact: false };
    let oldMarker = sim.state.boxScare;
    for (let tick = 0; tick < 120; tick++) {
      sim.step(neutral);
      comparison.step(neutral);
      if (tick === 60) containerScareSearchIndex(oldMarker, { ...oldMarker, lastTriggerTick: tick + 1 }, [0]);
      oldMarker = sim.state.boxScare;
    }
    expect(sim.snapshot()).toEqual(comparison.snapshot());
  });
});
