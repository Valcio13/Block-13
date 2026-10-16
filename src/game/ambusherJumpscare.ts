/** Presentation-only timing and variation for the screen-space Ambusher scare. */
export const AMBUSHER_JUMPSCARE_TIMING = {
  microGapMs: 55,
  impactMs: 500,
  impactPunchMs: 180,
  impactFlashMs: 38,
  afterimageMs: 220,
  cameraKickMs: 300,
} as const;

export type AmbusherJumpscarePhase = 'micro-gap' | 'impact' | 'afterimage' | 'recovery';
export const AMBUSHER_JUMPSCARE_VARIANTS = ['face', 'side_peek', 'open_maw', 'wrong_face'] as const;
export type AmbusherJumpscareVariant = typeof AMBUSHER_JUMPSCARE_VARIANTS[number];
export type AmbusherPresentationState = { id: number; state: string };
export interface AmbusherJumpscareFrame {
  phase: AmbusherJumpscarePhase;
  imageVisible: boolean;
  veilColor: number;
  veilAlpha: number;
  punch: number;
}

/** Alters only the rendered scare envelope; warning/damage timing stays authoritative. */
export function ambusherFrameForAccessibility(frame: AmbusherJumpscareFrame, reduceIntensity: boolean): AmbusherJumpscareFrame {
  if (!reduceIntensity) return frame;
  const veilAlpha = frame.phase === 'micro-gap' ? Math.min(frame.veilAlpha, 0.58)
    : frame.phase === 'impact' ? Math.min(frame.veilAlpha, 0.045)
      : Math.min(frame.veilAlpha, 0.08);
  return { ...frame, veilAlpha, punch: 1 + (frame.punch - 1) * 0.4 };
}

export function ambusherCameraKickIntensity(reduceIntensity: boolean): number {
  return reduceIntensity ? 0.0036 : 0.012;
}

const IMPACT_START = AMBUSHER_JUMPSCARE_TIMING.microGapMs;
const AFTERIMAGE_START = IMPACT_START + AMBUSHER_JUMPSCARE_TIMING.impactMs;
export const AMBUSHER_JUMPSCARE_TOTAL_MS = AFTERIMAGE_START + AMBUSHER_JUMPSCARE_TIMING.afterimageMs;

/** Return only the authoritative warning→impact edge; the warning itself has no face overlay. */
export function ambusherImpactStarted(
  previous: readonly AmbusherPresentationState[],
  current: readonly AmbusherPresentationState[],
): AmbusherPresentationState | undefined {
  return current.find(enemy => enemy.state === 'jumpscare'
    && previous.find(old => old.id === enemy.id)?.state !== 'jumpscare');
}

/** A stable base composition derived only from the authoritative scare edge. */
export function ambusherJumpscareVariant(enemyId: number, eventTick: number): number {
  let value = ((Math.trunc(eventTick) | 0) ^ Math.imul((Math.trunc(enemyId) + 1) | 0, 0x9e3779b9)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b) >>> 0;
  return value % AMBUSHER_JUMPSCARE_VARIANTS.length;
}

/** Scene-only repeat avoidance; the base hash and simulation remain unchanged. */
export function avoidImmediateAmbusherRepeat(base: number, previous?: number): number {
  return base === previous ? (base + 1) % AMBUSHER_JUMPSCARE_VARIANTS.length : base;
}

/** Explicit Local development preview only; ordinary encounters keep the stable hash. */
export function ambusherLocalPreviewVariant(search: string): number | undefined {
  const requested = new URLSearchParams(search).get('ambusherVariant')?.toLowerCase();
  const aliases: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
  if (requested === undefined) return undefined;
  if (Object.hasOwn(aliases, requested)) return aliases[requested];
  const index = AMBUSHER_JUMPSCARE_VARIANTS.findIndex(name => name === requested);
  return index >= 0 ? index : undefined;
}

/** Independent deterministic framing variation, without RNG consumption. */
export function ambusherJumpscareFraming(enemyId: number, eventTick: number): number {
  return ambusherJumpscareVariant(enemyId ^ 0x53a7, eventTick ^ 0x2d19) % 3;
}

export function ambusherJumpscareFrame(elapsedMs: number, variant: AmbusherJumpscareVariant = 'face'): AmbusherJumpscareFrame {
  if (elapsedMs < 0 || !Number.isFinite(elapsedMs)) return { phase: 'recovery', imageVisible: false, veilColor: 0x000000, veilAlpha: 0, punch: 1 };
  if (elapsedMs < IMPACT_START) {
    return { phase: 'micro-gap', imageVisible: false, veilColor: 0x03020a, veilAlpha: 0.86, punch: 1 };
  }
  if (elapsedMs < AFTERIMAGE_START) {
    const impactElapsed = elapsedMs - IMPACT_START;
    const punchProgress = Math.min(impactElapsed / AMBUSHER_JUMPSCARE_TIMING.impactPunchMs, 1);
    const initialPunch = variant === 'open_maw' ? 1.10 : variant === 'wrong_face' ? 1.035 : 1.08;
    const punch = initialPunch - (initialPunch - 1) * punchProgress;
    return {
      phase: 'impact', imageVisible: true,
      veilColor: 0x7c243b,
      veilAlpha: impactElapsed < AMBUSHER_JUMPSCARE_TIMING.impactFlashMs ? 0.14 : 0,
      punch,
    };
  }
  if (elapsedMs < AMBUSHER_JUMPSCARE_TOTAL_MS) {
    const afterimageElapsed = elapsedMs - AFTERIMAGE_START;
    return {
      phase: 'afterimage', imageVisible: false, veilColor: 0x17101e,
      veilAlpha: 0.13 * (1 - afterimageElapsed / AMBUSHER_JUMPSCARE_TIMING.afterimageMs), punch: 1,
    };
  }
  return { phase: 'recovery', imageVisible: false, veilColor: 0x000000, veilAlpha: 0, punch: 1 };
}

/** Advance only the cosmetic clock; retain one visible impact frame after a render stall. */
export function advanceAmbusherJumpscare(elapsedMs: number, deltaMs: number, impactPlayed: boolean) {
  const nextElapsed = elapsedMs + (Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0);
  const visibleElapsed = !impactPlayed && nextElapsed >= AFTERIMAGE_START ? IMPACT_START : nextElapsed;
  return {
    elapsedMs: visibleElapsed,
    impactBegins: !impactPlayed && ambusherJumpscareFrame(visibleElapsed).imageVisible,
  };
}

/** Fit within 90% of the 16:9 game viewport; no aspect distortion or mirroring. */
export function ambusherJumpscareLayout(
  width: number,
  height: number,
  textureWidth: number,
  textureHeight: number,
  variant: number,
  punch: number,
  composition: AmbusherJumpscareVariant = 'face',
) {
  const variants = [
    { offsetX: -0.012, scale: 0.97 },
    { offsetX: 0, scale: 1 },
    { offsetX: 0.012, scale: 1.03 },
  ] as const;
  const choice = variants[((Math.trunc(variant) % variants.length) + variants.length) % variants.length];
  const restraint = composition === 'wrong_face' ? 0.25 : composition === 'side_peek' ? 0.5 : 1;
  const compositionOffset = composition === 'side_peek' ? -0.008 : 0;
  const compositionScale = composition === 'open_maw' ? 1.015 : 1;
  const scale = Math.min(width * 0.9 / textureWidth, height * 0.9 / textureHeight)
    * (1 + (choice.scale - 1) * restraint) * compositionScale * punch;
  return { x: width * (0.5 + compositionOffset + choice.offsetX * restraint), y: height / 2, scale };
}

/** Dedicated art falls back through the existing authored warning art to its procedural sprite. */
export function ambusherJumpscareTextureKey(
  variant: AmbusherJumpscareVariant,
  textureExists: (key: string) => boolean,
  proceduralKey: string,
): string {
  const variantKey = variant === 'face' ? 'ambusher_jumpscare' : `ambusher_jumpscare_${variant}`;
  if (textureExists(variantKey)) return variantKey;
  if (textureExists('ambusher_jumpscare')) return 'ambusher_jumpscare';
  if (textureExists('ambusher_warning')) return 'ambusher_warning';
  return proceduralKey;
}
