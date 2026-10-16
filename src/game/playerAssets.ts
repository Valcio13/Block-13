import { assetPath } from '../core/assetPath';

/** Authored static player sprites. Presentation only; facing comes from simulation state. */
export const PLAYER_ASSET_MANIFEST = {
  down: { key: 'player_idle_down', path: assetPath('sprites/characters/player/player_idle_down.png'), width: 20, height: 28 },
  up: { key: 'player_idle_up', path: assetPath('sprites/characters/player/player_idle_up.png'), width: 20, height: 28 },
  left: { key: 'player_idle_left', path: assetPath('sprites/characters/player/player_idle_left.png'), width: 20, height: 28 },
  right: { key: 'player_idle_right', path: assetPath('sprites/characters/player/player_idle_right.png'), width: 20, height: 28 },
} as const;

export const PLAYER_WALK_ASSET_MANIFEST = {
  down01: { key: 'player_walk_down_01', path: assetPath('sprites/characters/player/player_walk_down_01.png'), width: 20, height: 28 },
  down02: { key: 'player_walk_down_02', path: assetPath('sprites/characters/player/player_walk_down_02.png'), width: 20, height: 28 },
  up01: { key: 'player_walk_up_01', path: assetPath('sprites/characters/player/player_walk_up_01.png'), width: 20, height: 28 },
  up02: { key: 'player_walk_up_02', path: assetPath('sprites/characters/player/player_walk_up_02.png'), width: 20, height: 28 },
  left01: { key: 'player_walk_left_01', path: assetPath('sprites/characters/player/player_walk_left_01.png'), width: 20, height: 28 },
  left02: { key: 'player_walk_left_02', path: assetPath('sprites/characters/player/player_walk_left_02.png'), width: 20, height: 28 },
  right01: { key: 'player_walk_right_01', path: assetPath('sprites/characters/player/player_walk_right_01.png'), width: 20, height: 28 },
  right02: { key: 'player_walk_right_02', path: assetPath('sprites/characters/player/player_walk_right_02.png'), width: 20, height: 28 },
} as const;

export type PlayerFacingDirection = keyof typeof PLAYER_ASSET_MANIFEST;
export const PLAYER_WALK_FRAME_RATE = 7.5;
const WALK_STEP_DURATION_MS = 1000 / PLAYER_WALK_FRAME_RATE;
export const PLAYER_WALK_CYCLE_DURATION_MS = WALK_STEP_DURATION_MS * 4;

/** Maps authoritative cardinal facing to its authored pose; zero defaults to down. */
export function playerFacingDirection(facingX: number, facingY: number): PlayerFacingDirection {
  if (facingY < 0) return 'up';
  if (facingY > 0) return 'down';
  if (facingX < 0) return 'left';
  if (facingX > 0) return 'right';
  return 'down';
}

export function playerTextureKeyForFacing(facingX: number, facingY: number): string {
  return PLAYER_ASSET_MANIFEST[playerFacingDirection(facingX, facingY)].key;
}

export function playerMovedBetween(
  previous: { x: number; y: number },
  current: { x: number; y: number },
): boolean {
  return previous.x !== current.x || previous.y !== current.y;
}

export function playerTextureKeyForPresentation(
  facingX: number,
  facingY: number,
  moving: boolean,
  elapsedMs: number,
  textureExists: (key: string) => boolean,
): string {
  const direction = playerFacingDirection(facingX, facingY);
  const idleKey = PLAYER_ASSET_MANIFEST[direction].key;
  if (!moving) return textureExists(idleKey) ? idleKey : 'player';

  const elapsedInCycle = ((elapsedMs % PLAYER_WALK_CYCLE_DURATION_MS) + PLAYER_WALK_CYCLE_DURATION_MS) % PLAYER_WALK_CYCLE_DURATION_MS;
  const phase = Math.floor(elapsedInCycle / WALK_STEP_DURATION_MS + 1e-9);
  const walkKey = phase === 0
    ? PLAYER_WALK_ASSET_MANIFEST[`${direction}01` as keyof typeof PLAYER_WALK_ASSET_MANIFEST].key
    : phase === 2
      ? PLAYER_WALK_ASSET_MANIFEST[`${direction}02` as keyof typeof PLAYER_WALK_ASSET_MANIFEST].key
      : idleKey;

  if (textureExists(walkKey)) return walkKey;
  return textureExists(idleKey) ? idleKey : 'player';
}
