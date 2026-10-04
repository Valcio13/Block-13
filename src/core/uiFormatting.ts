import { FIXED_SCALE } from './authoritativeSimulation';

/** UI-only percentage display: nearest integer, with exact halves rounded up. */
export function formatWholePercent(percent: number): number {
  if (!Number.isFinite(percent)) throw new RangeError('percent must be finite');
  return Math.floor(percent + 0.5);
}

/** Format authoritative 1/256-percent units without changing their value. */
export function formatFixedPointPercent(subunits: number): number {
  if (!Number.isSafeInteger(subunits)) throw new RangeError('fixed-point percent must be a safe integer');
  return Math.floor((subunits + FIXED_SCALE / 2) / FIXED_SCALE);
}
