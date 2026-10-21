/** Presentation-only cadence and gain. The authored clips have long tails, so
 * spacing footsteps also prevents their repeated tails from masking cues. */
export const PLAYER_FOOTSTEP_MIN_TICK_INTERVAL = 21; // ~2.9 events/second at 60 Hz
export const PLAYER_FOOTSTEP_COOLDOWN_MS = 320;
// Lowered again after playtest feedback so footsteps support, rather than
// compete with, ambience, music, and encounter cues.
export const PLAYER_FOOTSTEP_VARIANT_GAINS = [0.32, 0.49, 0.39] as const;

export function shouldPlayFootstep(previousTick: number, tick: number): boolean {
  return Number.isInteger(tick) && tick >= 0
    && (previousTick < 0 || tick - previousTick >= PLAYER_FOOTSTEP_MIN_TICK_INTERVAL);
}
