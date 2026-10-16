import { describe, expect, it } from 'vitest';
import { AuthoritativeSimulation, ENEMY_COLLISION_HALF_EXTENT_SUBPIXELS, FIXED_SCALE } from '../src/core/authoritativeSimulation';
import type { Floor } from '../src/core/floor';

const px = (tile: number) => (tile * 32 + 16) * FIXED_SCALE;
const emptyInput = { up: false, down: false, left: false, right: false, flashlight: false, interact: false };

function routedSimulation(enemy: 'stalker' | 'crawler' | 'mimic') {
  const start = [5, 10] as const, player = [10, 10] as const;
  const startX = px(start[0]), startY = px(start[1]);
  const playerX = px(player[0]), playerY = px(player[1]);
  const sim = new AuthoritativeSimulation(0x13c0111de5n, {
    // Floor 4's Stalker is authoritatively gated until its required photograph
    // is found. Mark that objective complete so this fixture exercises routing.
    floor: 4, x: playerX, y: playerY, objectiveComplete: true,
    stalker: enemy === 'stalker'
      ? { state: 'hunting', x: startX, y: startY, targetX: playerX, targetY: playerY, ticksRemaining: 0, chaseStartTick: 0, lastChaseEndTick: -600, visible: true, moveRemainder: 0 }
      : { state: 'dormant', x: startX, y: startY, targetX: startX, targetY: startY, ticksRemaining: 999, chaseStartTick: 0, lastChaseEndTick: 0, visible: false, moveRemainder: 0 },
    crawlers: enemy === 'crawler' ? [{ id: 1, x: startX, y: startY, targetX: playerX, targetY: playerY, chasing: true, chaseStartTick: 0, moveRemainder: 0 }] : [],
    mimics: enemy === 'mimic' ? [{ searchableIndex: 0, x: startX, y: startY, targetX: playerX, targetY: playerY, moveRemainder: 0, revealed: true, revealUntilTick: 0, chaseUntilTick: 500, active: true }] : [],
    watchers: [], ambushers: [],
  });

  const floor = sim.floor;
  const tiles = Array.from({ length: floor.height }, () => Array.from({ length: floor.width }, () => false));
  // A narrow corridor is blocked directly, with a two-cell route above it.
  for (let x = 5; x <= 10; x++) tiles[10][x] = true;
  tiles[10][7] = false;
  for (let y = 8; y <= 10; y++) tiles[y][5] = true;
  for (let x = 5; x <= 10; x++) tiles[8][x] = true;
  for (let y = 8; y <= 10; y++) tiles[y][10] = true;
  (sim as unknown as { floorValue: Floor }).floorValue.tiles = tiles;
  return { sim, tiles, start, player };
}

function expectFootprintWalkable(x: number, y: number, tiles: boolean[][]) {
  const tile = 32 * FIXED_SCALE, half = ENEMY_COLLISION_HALF_EXTENT_SUBPIXELS;
  const minX = Math.floor((x - half) / tile), maxX = Math.floor((x + half - 1) / tile);
  const minY = Math.floor((y - half) / tile), maxY = Math.floor((y + half - 1) / tile);
  for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) expect(tiles[ty]?.[tx]).toBe(true);
}

describe('authoritative enemy wall navigation', () => {
  it.each(['stalker', 'crawler', 'mimic'] as const)('%s routes around a blocking wall and keeps its footprint walkable', enemy => {
    const { sim, tiles } = routedSimulation(enemy);
    const before = sim.state;
    const position = (state: typeof before) => enemy === 'stalker' ? state.stalker : enemy === 'crawler' ? state.crawlers[0] : state.mimics[0];
    for (let tick = 0; tick < 360; tick++) {
      const state = sim.step(emptyInput);
      const actor = position(state);
      expectFootprintWalkable(actor.x, actor.y, tiles);
      expect(actor.x).not.toBeGreaterThan(px(7) - ENEMY_COLLISION_HALF_EXTENT_SUBPIXELS);
      if (actor.y < px(10) && actor.x > px(7)) break;
    }
    const after = position(sim.state);
    expect(after.y).toBeLessThan(px(10));
    expect(after.x).toBeGreaterThan(px(5));
    expect(after.x).toBeLessThanOrEqual(px(10));
  });

  it('uses stable cardinal route tie-breaking and produces identical enemy movement for the same seed and inputs', () => {
    const a = routedSimulation('stalker').sim, b = routedSimulation('stalker').sim;
    const positionsA = [], positionsB = [];
    for (let i = 0; i < 120; i++) {
      positionsA.push(a.step(emptyInput).stalker);
      positionsB.push(b.step(emptyInput).stalker);
    }
    expect(positionsA).toEqual(positionsB);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('slides along an adjacent wall and refuses a diagonal corner cut', () => {
    const sim = new AuthoritativeSimulation(17n, { crawlers: [], watchers: [], ambushers: [], mimics: [] });
    const internal = sim as unknown as { floorValue: Floor; moveActor(actor: { x: number; y: number; targetX: number; targetY: number; moveRemainder: number }, speed: number): void };
    const tiles = Array.from({ length: sim.floor.height }, () => Array.from({ length: sim.floor.width }, () => false));
    tiles[3][3] = true;
    internal.floorValue.tiles = tiles;
    const startX = px(3) + 8 * FIXED_SCALE, startY = px(3);
    const sliding = { x: startX, y: startY, targetX: px(3) + 15 * FIXED_SCALE, targetY: startY + 2 * FIXED_SCALE, moveRemainder: 0 };
    internal.moveActor(sliding, 180);
    expect(sliding.x).toBe(startX);
    expect(sliding.y).toBeGreaterThan(startY);
    expectFootprintWalkable(sliding.x, sliding.y, tiles);

    tiles[4][3] = false;
    const cornered = { x: startX, y: startY + 8 * FIXED_SCALE, targetX: px(3) + 15 * FIXED_SCALE, targetY: startY + 10 * FIXED_SCALE, moveRemainder: 0 };
    const before = { ...cornered };
    internal.moveActor(cornered, 180);
    expect(cornered.x).toBe(before.x);
    expect(cornered.y).toBe(before.y);
    expectFootprintWalkable(cornered.x, cornered.y, tiles);
  });

  it('spawns mobile and stationary enemies on walkable tile centers', () => {
    const sim = new AuthoritativeSimulation(0x5eedn, { floor: 1 });
    const { state, floor } = sim.snapshot();
    const entities = [state.stalker, ...state.crawlers, ...state.watchers, ...state.ambushers, ...state.mimics];
    expect(entities.length).toBeGreaterThan(0);
    for (const entity of entities) {
      const x = Math.floor(entity.x / (32 * FIXED_SCALE)), y = Math.floor(entity.y / (32 * FIXED_SCALE));
      expect(floor.tiles[y]?.[x]).toBe(true);
      expect(entity.x % (32 * FIXED_SCALE)).toBe(16 * FIXED_SCALE);
      expect(entity.y % (32 * FIXED_SCALE)).toBe(16 * FIXED_SCALE);
    }
  });
});
