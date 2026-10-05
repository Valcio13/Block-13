import { describe, expect, it } from 'vitest';
import type { Floor } from '../src/core/floor';
import { traceLightRay, visibilityPointIsUnoccluded } from '../src/game/lightOcclusion';

function fixture(walls: Array<[number, number]> = []): Floor {
  const tiles = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => true));
  for (const [x, y] of walls) tiles[y][x] = false;
  return { width: 8, height: 8, tiles } as Floor;
}

describe('presentation light wall occlusion', () => {
  it('stops horizontal and vertical rays at the first wall face', () => {
    const horizontal = traceLightRay(fixture([[3, 1]]).tiles, 32, 48, 48, 0, 200);
    const vertical = traceLightRay(fixture([[1, 3]]).tiles, 32, 48, 48, Math.PI / 2, 200);
    expect(horizontal.distance).toBeCloseTo(48, 6);
    expect(vertical.distance).toBeCloseTo(48, 6);
  });

  it('permits light through an open doorway and blocks it when the doorway tile is a wall', () => {
    expect(visibilityPointIsUnoccluded(fixture(), 48, 48, 144, 48)).toBe(true);
    expect(visibilityPointIsUnoccluded(fixture([[3, 1]]), 48, 48, 144, 48)).toBe(false);
  });

  it('blocks exact diagonal corner crossings instead of leaking between adjacent wall tiles', () => {
    const map = fixture([[2, 1], [1, 2]]);
    const ray = traceLightRay(map.tiles, 32, 48, 48, Math.PI / 4, 100);
    expect(ray.distance).toBeCloseTo(Math.sqrt(512), 5);
    expect(visibilityPointIsUnoccluded(map, 48, 48, 80, 80)).toBe(false);
  });

  it('uses the same wall-respecting visibility for the local ambient radius', () => {
    const map = fixture([[3, 1]]);
    expect(visibilityPointIsUnoccluded(map, 48, 48, 80, 48)).toBe(true);
    expect(visibilityPointIsUnoccluded(map, 48, 48, 112, 48)).toBe(false);
  });
});
