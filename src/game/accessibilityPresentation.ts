export const REDUCED_PRESENTATION_INTENSITY = 0.56;

export function accessiblePresentationIntensity(intensity: number, reduceJumpscareIntensity: boolean): number {
  const safe = Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 0;
  return reduceJumpscareIntensity ? safe * REDUCED_PRESENTATION_INTENSITY : safe;
}

export function genericScareCameraKick(reduceJumpscareIntensity: boolean) {
  return reduceJumpscareIntensity
    ? { durationMs: 140, intensity: 0.003 }
    : { durationMs: 220, intensity: 0.006 };
}

export function stalkerHuntScale(reduceJumpscareIntensity: boolean, finalChase: boolean): number {
  if (reduceJumpscareIntensity) return finalChase ? 1.12 : 1.06;
  return finalChase ? 1.3 : 1.14;
}

/** Temporary ambience mix trim for the Block 13 pursuit; category settings still own final gain. */
export function finalChaseAmbienceGain(reduceJumpscareIntensity: boolean): number {
  return reduceJumpscareIntensity ? 0.68 : 0.46;
}
