import { describe, expect, it } from 'vitest';
import { architecturalMarkAt } from '../src/core/visualAtmosphere';
import {
  KEY_PIXEL_RECTS,
  pixelRectsAreValid,
  PLAYER_PIXEL_RECTS,
  STAIR_PIXEL_RECTS,
  STALKER_PIXEL_RECTS,
} from '../src/game/pixelIdentity';

describe('pixel identity presentation data', () => {
  it('keeps the authored player, Stalker, key, and stair shapes inside integer pixel grids', () => {
    expect(pixelRectsAreValid(PLAYER_PIXEL_RECTS, 20, 28)).toBe(true);
    expect(pixelRectsAreValid(STALKER_PIXEL_RECTS, 32, 52)).toBe(true);
    expect(pixelRectsAreValid(KEY_PIXEL_RECTS, 20, 28)).toBe(true);
    expect(pixelRectsAreValid(STAIR_PIXEL_RECTS(false), 32, 32)).toBe(true);
    expect(pixelRectsAreValid(STAIR_PIXEL_RECTS(true), 32, 32)).toBe(true);
    expect(STALKER_PIXEL_RECTS.some(rect => rect.color === 'stalkerEye')).toBe(true);
    expect(PLAYER_PIXEL_RECTS.some(rect => rect.color === 'reflective')).toBe(true);
    expect(PLAYER_PIXEL_RECTS.some(rect => rect.color === 'flashlight')).toBe(true);
  });

  it('uses stable coordinate-only surface marks with distinct motifs per stage', () => {
    const marksByBlock = new Map<number, Set<string>>();
    for (const floor of [4, 3, 2, 1, 0]) {
      const marks = new Set<string>();
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 20; x++) {
          const walkable = (x + y) % 2 === 0;
          const first = architecturalMarkAt(floor, x, y, walkable);
          expect(architecturalMarkAt(floor, x, y, walkable)).toBe(first);
          if (first) marks.add(first);
        }
      }
      marksByBlock.set(floor, marks);
    }
    expect([...marksByBlock.get(4)!]).toEqual(['orderly_seam', 'clean_wall']);
    expect([...marksByBlock.get(3)!]).toEqual(['peel']);
    expect([...marksByBlock.get(2)!]).toEqual(['warning_repeat']);
    expect([...marksByBlock.get(1)!]).toEqual(['fracture']);
    expect([...marksByBlock.get(0)!]).toEqual(['paradox_wall']);
  });
});
