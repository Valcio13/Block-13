import { describe, expect, it } from 'vitest';
import { AuthoritativeSimulation, FIXED_SCALE } from '../src/core/authoritativeSimulation';
import type { Floor } from '../src/core/floor';
import { enemyPresentationExposure, hasPresentationLineOfSight } from '../src/game/presentationVisibility';

const sightFloor = (tiles: boolean[][]): Floor => ({
  width: tiles[0].length,
  height: tiles.length,
  tiles,
  start: [0, 0], key: [0, 0], exit: [0, 0],
  rooms: [], doors: [], searchables: [],
});

describe('enemy presentation visibility', () => {
  it('blocks silhouettes and flashlight exposure through walls', () => {
    const floor = sightFloor([
      [true, false, true],
      [true, true, true],
      [true, true, true],
    ]);
    const sim = new AuthoritativeSimulation(7n);
    const state = { ...sim.state, x: 16 * FIXED_SCALE, y: 16 * FIXED_SCALE, facingX: 1, facingY: 0, flashlightOn: true };
    expect(hasPresentationLineOfSight(floor, 16, 16, 80, 16)).toBe(false);
    expect(enemyPresentationExposure(floor, state, 80 * FIXED_SCALE, 16 * FIXED_SCALE)).toBe(0);
  });

  it('makes a visible enemy clearer in player light while keeping darkness restrained', () => {
    const floor = sightFloor([
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true],
    ]);
    const sim = new AuthoritativeSimulation(8n);
    const darkState = { ...sim.state, x: 16 * FIXED_SCALE, y: 16 * FIXED_SCALE, facingX: 1, facingY: 0, flashlightOn: false };
    const litState = { ...darkState, flashlightOn: true };
    const enemyX = 128 * FIXED_SCALE, enemyY = 16 * FIXED_SCALE;
    expect(enemyPresentationExposure(floor, darkState, enemyX, enemyY)).toBe(0.22);
    expect(enemyPresentationExposure(floor, litState, enemyX, enemyY)).toBe(1);
    expect(enemyPresentationExposure(floor, litState, 16 * FIXED_SCALE, 128 * FIXED_SCALE)).toBe(0.22);
  });
});
