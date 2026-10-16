import { describe, expect, it } from 'vitest';
import { stalkerNearMissCueAvailable, stalkerNearMissState } from '../src/game/stalkerPresentation';

describe('Stalker near-miss presentation', () => {
  it('signals one real close-pursuit edge and uses hysteresis until distance is safe', () => {
    expect(stalkerNearMissState(90, true, false)).toEqual({ active: true, entered: true });
    expect(stalkerNearMissState(110, true, true)).toEqual({ active: true, entered: false });
    expect(stalkerNearMissState(140, true, true)).toEqual({ active: false, entered: false });
    expect(stalkerNearMissState(50, false, false)).toEqual({ active: false, entered: false });
  });

  it('limits repeat near-miss camera cues to one per presentation recovery interval', () => {
    expect(stalkerNearMissCueAvailable(1000, Number.NEGATIVE_INFINITY)).toBe(true);
    expect(stalkerNearMissCueAvailable(4199, 1000)).toBe(false);
    expect(stalkerNearMissCueAvailable(4200, 1000)).toBe(true);
    expect(stalkerNearMissCueAvailable(Number.NaN, 1000)).toBe(false);
  });
});
