import type { Floor } from '../core/floor';
import { FIXED_SCALE, type AuthoritativeState } from '../core/authoritativeSimulation';

const TILE_SIZE = 32;
const LIGHT_RANGE = 286;
const LOCAL_LIGHT_RANGE = 88;

/** Presentation-only exposure; never passed back to the simulation. */
export function enemyPresentationExposure(
  floor: Floor,
  state: AuthoritativeState,
  enemyXSubpixels: number,
  enemyYSubpixels: number,
): number {
  const playerX = state.x / FIXED_SCALE;
  const playerY = state.y / FIXED_SCALE;
  const enemyX = enemyXSubpixels / FIXED_SCALE;
  const enemyY = enemyYSubpixels / FIXED_SCALE;
  const dx = enemyX - playerX;
  const dy = enemyY - playerY;
  const distanceSquared = dx * dx + dy * dy;
  if (!hasPresentationLineOfSight(floor, playerX, playerY, enemyX, enemyY)) return 0;

  if (state.flashlightOn && distanceSquared <= LIGHT_RANGE * LIGHT_RANGE) {
    const dot = dx * state.facingX + dy * state.facingY;
    // The simulation's cardinal facing and a 35-degree presentation cone.
    if (dot > 0 && dot * dot * 10_000 >= distanceSquared * 6_710) return 1;
  }
  if (distanceSquared <= LOCAL_LIGHT_RANGE * LOCAL_LIGHT_RANGE) return 0.72;
  return 0.22;
}

/** Supercover grid trace: corner-adjacent walls also block the sight line. */
export function hasPresentationLineOfSight(floor: Floor, x1: number, y1: number, x2: number, y2: number): boolean {
  let x = Math.floor(x1 / TILE_SIZE), y = Math.floor(y1 / TILE_SIZE);
  const targetX = Math.floor(x2 / TILE_SIZE), targetY = Math.floor(y2 / TILE_SIZE);
  const dx = Math.abs(targetX - x), dy = Math.abs(targetY - y);
  const stepX = x < targetX ? 1 : -1, stepY = y < targetY ? 1 : -1;
  let error = dx - dy;
  const walkable = (tx: number, ty: number) => Boolean(floor.tiles[ty]?.[tx]);

  while (x !== targetX || y !== targetY) {
    const oldX = x, oldY = y;
    const twiceError = error * 2;
    let movedX = false, movedY = false;
    if (twiceError > -dy) { error -= dy; x += stepX; movedX = true; }
    if (twiceError < dx) { error += dx; y += stepY; movedY = true; }
    if (movedX && movedY && (!walkable(x, oldY) || !walkable(oldX, y))) return false;
    if ((x !== targetX || y !== targetY) && !walkable(x, y)) return false;
  }
  return walkable(targetX, targetY);
}
