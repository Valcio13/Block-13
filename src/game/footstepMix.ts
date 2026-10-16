/** Presentation-only cadence and gain. The authored clips have long tails, so
 * spacing footsteps also prevents their repeated tails from masking cues. */
export const PLAYER_FOOTSTEP_MIN_TICK_INTERVAL = 21; // ~2.9 events/second at 60 Hz
export const PLAYER_FOOTSTEP_COOLDOWN_MS = 320;
// 70% of the previous per-variant gain. Combined with the slightly slower
// cadence this lowers average mix energy by about 40% while retaining clear hits.
export const PLAYER_FOOTSTEP_VARIANT_GAINS = [0.455, 0.70, 0.553] as const;

export function shouldPlayFootstep(previousTick: number, tick: number): boolean {
  return Number.isInteger(tick) && tick >= 0
    && (previousTick < 0 || tick - previousTick >= PLAYER_FOOTSTEP_MIN_TICK_INTERVAL);
}
