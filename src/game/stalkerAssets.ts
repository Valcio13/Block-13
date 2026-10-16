import { assetPath } from '../core/assetPath';

/** Authored Stalker idle poses. Direction is inferred from presentation snapshots. */
export const STALKER_IDLE_ASSET_MANIFEST = {
  down: { key: 'stalker_idle_down', path: assetPath('sprites/characters/stalker/stalker_idle_down.png'), width: 32, height: 52 },
  up: { key: 'stalker_idle_up', path: assetPath('sprites/characters/stalker/stalker_idle_up.png'), width: 32, height: 52 },
  left: { key: 'stalker_idle_left', path: assetPath('sprites/characters/stalker/stalker_idle_left.png'), width: 32, height: 52 },
  right: { key: 'stalker_idle_right', path: assetPath('sprites/characters/stalker/stalker_idle_right.png'), width: 32, height: 52 },
} as const;

export const STALKER_WALK_ASSET_MANIFEST = {
  down01: { key: 'stalker_walk_down_01', path: assetPath('sprites/characters/stalker/stalker_walk_down_01.png'), width: 32, height: 52 },
  down02: { key: 'stalker_walk_down_02', path: assetPath('sprites/characters/stalker/stalker_walk_down_02.png'), width: 32, height: 52 },
  up01: { key: 'stalker_walk_up_01', path: assetPath('sprites/characters/stalker/stalker_walk_up_01.png'), width: 32, height: 52 },
  up02: { key: 'stalker_walk_up_02', path: assetPath('sprites/characters/stalker/stalker_walk_up_02.png'), width: 32, height: 52 },
  left01: { key: 'stalker_walk_left_01', path: assetPath('sprites/characters/stalker/stalker_walk_left_01.png'), width: 32, height: 52 },
  left02: { key: 'stalker_walk_left_02', path: assetPath('sprites/characters/stalker/stalker_walk_left_02.png'), width: 32, height: 52 },
  right01: { key: 'stalker_walk_right_01', path: assetPath('sprites/characters/stalker/stalker_walk_right_01.png'), width: 32, height: 52 },
  right02: { key: 'stalker_walk_right_02', path: assetPath('sprites/characters/stalker/stalker_walk_right_02.png'), width: 32, height: 52 },
} as const;

export const STALKER_WALK_FRAME_RATE = 6.5;
const STALKER_WALK_STEP_DURATION_MS = 1000 / STALKER_WALK_FRAME_RATE;
export const STALKER_WALK_CYCLE_DURATION_MS = STALKER_WALK_STEP_DURATION_MS * 4;

export type StalkerVisualFacing = keyof typeof STALKER_IDLE_ASSET_MANIFEST;

/**
 * Infer a visual facing from authoritative position snapshots without mutating
 * either snapshot. Equal diagonal deltas use the horizontal axis consistently.
 */
export function inferStalkerVisualFacing(
  previous: { x: number; y: number },
  current: { x: number; y: number },
  lastFacing: StalkerVisualFacing = 'down',
): StalkerVisualFacing {
  const dx = current.x - previous.x;
  const dy = current.y - previous.y;
  if (dx === 0 && dy === 0) return lastFacing;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

/** Use authored direction art when loaded, otherwise keep the generated fallback. */
export function stalkerTextureKeyForFacing(
  facing: StalkerVisualFacing,
  textureExists: (key: string) => boolean,
): string {
  const authoredKey = STALKER_IDLE_ASSET_MANIFEST[facing].key;
  return textureExists(authoredKey) ? authoredKey : 'stalker';
}

/** Detect motion solely from authoritative position snapshots. */
export function stalkerMovedBetween(
  previous: { x: number; y: number },
  current: { x: number; y: number },
): boolean {
  return previous.x !== current.x || previous.y !== current.y;
}

/**
 * Select a directional idle pose or the four-step walk cycle. Missing walking
 * frames fall back to that direction's idle, then to the procedural texture.
 */
export function stalkerTextureKeyForPresentation(
  facing: StalkerVisualFacing,
  moving: boolean,
  elapsedMs: number,
  textureExists: (key: string) => boolean,
): string {
  const idleKey = STALKER_IDLE_ASSET_MANIFEST[facing].key;
  if (!moving) return textureExists(idleKey) ? idleKey : 'stalker';

  const elapsedInCycle = ((elapsedMs % STALKER_WALK_CYCLE_DURATION_MS) + STALKER_WALK_CYCLE_DURATION_MS) % STALKER_WALK_CYCLE_DURATION_MS;
  const phase = Math.floor(elapsedInCycle / STALKER_WALK_STEP_DURATION_MS + 1e-9);
  const walkKey = phase === 0 || phase === 2
    ? STALKER_WALK_ASSET_MANIFEST[`${facing}${phase === 0 ? '01' : '02'}` as keyof typeof STALKER_WALK_ASSET_MANIFEST].key
    : idleKey;
  if (textureExists(walkKey)) return walkKey;
  return textureExists(idleKey) ? idleKey : 'stalker';
}
