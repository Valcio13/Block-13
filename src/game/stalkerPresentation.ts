export interface StalkerNearMissState { active: boolean; entered: boolean; }
export const STALKER_NEAR_MISS_CUE_COOLDOWN_MS = 3200;

export function stalkerNearMissCueAvailable(nowMs: number, lastCueMs: number): boolean {
  return Number.isFinite(nowMs) && nowMs - lastCueMs >= STALKER_NEAR_MISS_CUE_COOLDOWN_MS;
}

/** Hysteresis prevents repeat camera feedback while a real chase stays close. */
export function stalkerNearMissState(distancePx: number, hunting: boolean, wasActive: boolean): StalkerNearMissState {
  if (!hunting || !Number.isFinite(distancePx) || distancePx > 132) return { active: false, entered: false };
  const active = distancePx <= 96 || wasActive;
  return { active, entered: active && !wasActive };
}
