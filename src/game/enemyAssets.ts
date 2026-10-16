import { assetPath } from '../core/assetPath';
import type { AuthoritativeState } from '../core/authoritativeSimulation';
import { watcherIndividuallyCausingCurse, watcherIsCausingCurse } from './contestUx';

/** Authored Block 13 enemy sprites. These are presentation assets only. */
export const ENEMY_ASSET_MANIFEST = {
  forgotten_appearance: { key: 'forgotten_appearance', path: assetPath('sprites/enemies/forgotten/forgotten_appearance.png'), width: 32, height: 52 },
  crawler_idle: { key: 'crawler_idle', path: assetPath('sprites/enemies/crawler/crawler_idle.png'), width: 28, height: 20 },
  crawler_walk_01: { key: 'crawler_walk_01', path: assetPath('sprites/enemies/crawler/crawler_walk_01.png'), width: 28, height: 20 },
  crawler_walk_02: { key: 'crawler_walk_02', path: assetPath('sprites/enemies/crawler/crawler_walk_02.png'), width: 28, height: 20 },
  watcher_idle: { key: 'watcher_idle', path: assetPath('sprites/enemies/watcher/watcher_idle.png'), width: 34, height: 44 },
  ambusher_warning: { key: 'ambusher_warning', path: assetPath('sprites/enemies/ambusher/ambusher_warning.png'), width: 28, height: 38 },
  mimic_disguise: { key: 'mimic_disguise', path: assetPath('sprites/enemies/mimic/mimic_disguise.png'), width: 24, height: 24 },
  mimic_revealed: { key: 'mimic_revealed', path: assetPath('sprites/enemies/mimic/mimic_revealed.png'), width: 28, height: 24 },
} as const;

/** Optional, separately composed screen-space impact art; the encounter falls back when absent. */
export const AMBUSHER_JUMPSCARE_ASSET = {
  key: 'ambusher_jumpscare',
  path: assetPath('sprites/enemies/ambusher/ambusher_jumpscare.png'),
  width: 576,
  height: 324,
} as const;

/** Optional authored impact compositions. Missing files fall back at presentation time. */
export const AMBUSHER_JUMPSCARE_VARIANT_ASSETS = {
  face: AMBUSHER_JUMPSCARE_ASSET,
  side_peek: { key: 'ambusher_jumpscare_side_peek', path: assetPath('sprites/enemies/ambusher/ambusher_jumpscare_side_peek.png'), width: 576, height: 324 },
  open_maw: { key: 'ambusher_jumpscare_open_maw', path: assetPath('sprites/enemies/ambusher/ambusher_jumpscare_open_maw.png'), width: 576, height: 324 },
  wrong_face: { key: 'ambusher_jumpscare_wrong_face', path: assetPath('sprites/enemies/ambusher/ambusher_jumpscare_wrong_face.png'), width: 576, height: 324 },
} as const;

export const CRAWLER_WALK_FRAME_RATE = 8;
export const CRAWLER_FRAME_STEP_MS = 1000 / CRAWLER_WALK_FRAME_RATE;
export const CRAWLER_WALK_CYCLE_DURATION_MS = CRAWLER_FRAME_STEP_MS * 4;

/** Stable per-creature cycle offset breaks synchronized group movement without RNG. */
export function crawlerPresentationPhaseOffsetMs(entityId: number): number {
  return Number.isFinite(entityId) ? (Math.abs(Math.trunc(entityId)) % 4) * CRAWLER_FRAME_STEP_MS : 0;
}

export function crawlerMovedBetween(previous: { x: number; y: number }, current: { x: number; y: number }): boolean {
  return previous.x !== current.x || previous.y !== current.y;
}

/** walk_01 → idle → walk_02 → idle, with missing art degrading to idle/procedural. */
export function crawlerTextureKeyForPresentation(
  moving: boolean,
  elapsedMs: number,
  textureExists: (key: string) => boolean,
  proceduralFallback: string,
  phaseOffsetMs = 0,
): string {
  if (!moving) return textureExists('crawler_idle') ? 'crawler_idle' : proceduralFallback;
  const phaseTime = elapsedMs + (Number.isFinite(phaseOffsetMs) ? phaseOffsetMs : 0);
  const elapsed = ((phaseTime % CRAWLER_WALK_CYCLE_DURATION_MS) + CRAWLER_WALK_CYCLE_DURATION_MS) % CRAWLER_WALK_CYCLE_DURATION_MS;
  const step = Math.floor(elapsed / CRAWLER_FRAME_STEP_MS + 1e-9);
  const desired = step === 0 ? 'crawler_walk_01' : step === 2 ? 'crawler_walk_02' : 'crawler_idle';
  if (textureExists(desired)) return desired;
  return textureExists('crawler_idle') ? 'crawler_idle' : proceduralFallback;
}

export function watcherTextureKey(textureExists: (key: string) => boolean, proceduralFallback: string): string {
  return textureExists('watcher_idle') ? 'watcher_idle' : proceduralFallback;
}

export function ambusherTextureKey(textureExists: (key: string) => boolean, proceduralFallback: string): string {
  return textureExists('ambusher_warning') ? 'ambusher_warning' : proceduralFallback;
}

/** Slower low-amplitude warning breath; leaves the authoritative scare timer untouched. */
export function ambusherWarningAlpha(exposure: number, tick: number, entityId: number): number {
  const visible = Number.isFinite(exposure) ? Math.max(0, Math.min(1, exposure)) : 0;
  const phase = Number.isFinite(tick) ? tick : 0;
  const id = Number.isFinite(entityId) ? entityId : 0;
  return visible * (0.64 + (Math.sin(phase * 0.08 + id) + 1) * 0.11);
}

export function mimicTextureKey(
  revealed: boolean,
  textureExists: (key: string) => boolean,
  proceduralFallback: string,
): string {
  const authored = revealed ? 'mimic_revealed' : 'mimic_disguise';
  return textureExists(authored) ? authored : proceduralFallback;
}

/** Brief purely visual recoil on an already-authoritative Mimic reveal edge. */
export const MIMIC_REVEAL_PULSE_DURATION_MS = 300;
export function mimicRevealPulseScale(elapsedMs: number, settledScale = 1.2): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs >= MIMIC_REVEAL_PULSE_DURATION_MS) return settledScale;
  const fade = 1 - elapsedMs / MIMIC_REVEAL_PULSE_DURATION_MS;
  return settledScale + Math.sin((elapsedMs / 100) * Math.PI) * 0.12 * fade;
}

/** Pixel-eye accents show only when an active Watcher is in the player's real gaze cone. */
export function watcherGazeEyeAlpha(active: boolean, gazeIsCausingCurse: boolean, exposure: number): number {
  if (!active || !gazeIsCausingCurse) return 0;
  const readableExposure = Number.isFinite(exposure) ? Math.max(0, Math.min(1, exposure)) : 0;
  return Math.max(0.34, readableExposure * 0.78);
}

/** Return one positional audio target when gaze begins after an already-present Watcher. */
export function watcherGazeAudioPosition(previous: AuthoritativeState, current: AuthoritativeState): { x: number; y: number } | undefined {
  if (watcherIsCausingCurse(previous) || !watcherIsCausingCurse(current)) return undefined;
  const newlyActivated = current.watchers.some(watcher => watcher.active
    && !previous.watchers.find(old => old.id === watcher.id)?.active);
  if (newlyActivated) return undefined;
  const watcher = current.watchers.find(candidate => watcherIndividuallyCausingCurse(current, candidate));
  return watcher ? { x: watcher.x, y: watcher.y } : undefined;
}
