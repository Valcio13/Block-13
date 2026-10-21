import type { BoxScareSnapshot } from '../core/authoritativeSimulation';

export const CONTAINER_SCARE_STATUS_TEXT = 'JUMPSCARED\nMOVEMENT LOCKED';

/** A presentation event is eligible only when the authoritative box-scare
 * marker advanced on this search. It never chooses or changes the outcome. */
export function containerScareSearchIndex(
  previous: BoxScareSnapshot,
  current: BoxScareSnapshot,
  searchedIndices: readonly number[],
): number | null {
  if (current.lastTriggerTick <= previous.lastTriggerTick || searchedIndices.length === 0) return null;
  const index = searchedIndices[0];
  return Number.isInteger(index) && index >= 0 ? index : null;
}

export function containerScareStyle(reducedIntensity: boolean) {
  return reducedIntensity
    ? { durationMs: 300, peakAlpha: 0.42, peakScale: 1.08 }
    : { durationMs: 500, peakAlpha: 0.82, peakScale: 1.2 };
}

export function containerScareShouldPlay(
  changed: boolean,
  ambusherJumpscareActive: boolean,
  sceneCanPresent: boolean,
): boolean {
  return changed && !ambusherJumpscareActive && sceneCanPresent;
}
