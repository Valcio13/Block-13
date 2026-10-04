import { describe, expect, it } from 'vitest';
import { formatFixedPointPercent, formatWholePercent } from './uiFormatting';

describe('player-facing percentage formatting', () => {
  it('rounds to nearest whole percent with ties upward', () => {
    expect(formatWholePercent(66.49)).toBe(66);
    expect(formatWholePercent(66.5)).toBe(67);
    expect(formatFixedPointPercent(5111)).toBe(20); // 19.96484375%
    expect(formatFixedPointPercent(66 * 256 + 127)).toBe(66);
    expect(formatFixedPointPercent(66 * 256 + 128)).toBe(67);
  });

  it('rejects invalid display values', () => {
    expect(() => formatWholePercent(Number.NaN)).toThrow(RangeError);
    expect(() => formatFixedPointPercent(1.25)).toThrow(RangeError);
  });
});
