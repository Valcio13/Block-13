import { describe, expect, it } from 'vitest';
import { PLAYER_FOOTSTEP_COOLDOWN_MS, PLAYER_FOOTSTEP_MIN_TICK_INTERVAL, PLAYER_FOOTSTEP_VARIANT_GAINS, shouldPlayFootstep } from '../src/game/footstepMix';

describe('player footstep presentation mix', () => {
  it('reduces the per-variant gain by 30% and spaces cues enough to reduce overlap', () => {
    const old = [0.65, 1, 0.79];
    PLAYER_FOOTSTEP_VARIANT_GAINS.forEach((gain, index) => expect(gain / old[index]).toBeCloseTo(0.7));
    expect(PLAYER_FOOTSTEP_MIN_TICK_INTERVAL).toBe(21);
    expect(PLAYER_FOOTSTEP_COOLDOWN_MS).toBeGreaterThanOrEqual(300);
  });

  it('throttles rapid movement updates without changing movement input', () => {
    expect(shouldPlayFootstep(-100, 0)).toBe(true);
    expect(shouldPlayFootstep(10, 30)).toBe(false);
    expect(shouldPlayFootstep(10, 31)).toBe(true);
    expect(shouldPlayFootstep(10, 31)).toBe(shouldPlayFootstep(10, 31));
  });
});
