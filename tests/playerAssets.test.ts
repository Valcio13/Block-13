import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PLAYER_ASSET_MANIFEST,
  PLAYER_WALK_ASSET_MANIFEST,
  PLAYER_WALK_FRAME_RATE,
  playerFacingDirection,
  playerMovedBetween,
  playerTextureKeyForFacing,
  playerTextureKeyForPresentation,
} from '../src/game/playerAssets';

describe('authored player presentation assets', () => {
  it('registers exact-size transparent RGBA PNGs for all four cardinal directions', () => {
    expect(Object.keys(PLAYER_ASSET_MANIFEST)).toHaveLength(4);
    expect(Object.keys(PLAYER_WALK_ASSET_MANIFEST)).toHaveLength(8);
    for (const asset of [...Object.values(PLAYER_ASSET_MANIFEST), ...Object.values(PLAYER_WALK_ASSET_MANIFEST)]) {
      const png = readFileSync(new URL(`../public${asset.path}`, import.meta.url));
      expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(png.readUInt32BE(16)).toBe(20);
      expect(png.readUInt32BE(20)).toBe(28);
      expect(png[25]).toBe(6); // PNG color type 6: RGBA
    }
  });

  it('maps authoritative cardinal facing to the matching authored texture without rotation or mirroring', () => {
    expect(playerFacingDirection(0, 1)).toBe('down');
    expect(playerFacingDirection(0, -1)).toBe('up');
    expect(playerFacingDirection(-1, 0)).toBe('left');
    expect(playerFacingDirection(1, 0)).toBe('right');
    expect(playerFacingDirection(0, 0)).toBe('down');
    expect(playerTextureKeyForFacing(0, 1)).toBe('player_idle_down');
    expect(playerTextureKeyForFacing(0, -1)).toBe('player_idle_up');
    expect(playerTextureKeyForFacing(-1, 0)).toBe('player_idle_left');
    expect(playerTextureKeyForFacing(1, 0)).toBe('player_idle_right');
    // If a diagonal vector is passed, vertical-facing priority matches simulation input handling.
    expect(playerFacingDirection(1, -1)).toBe('up');
  });

  it('returns the directional idle texture while stationary and detects movement from authoritative positions', () => {
    expect(playerTextureKeyForPresentation(0, 1, false, 0, () => true)).toBe('player_idle_down');
    expect(playerTextureKeyForPresentation(0, -1, false, 0, () => true)).toBe('player_idle_up');
    expect(playerTextureKeyForPresentation(-1, 0, false, 0, () => true)).toBe('player_idle_left');
    expect(playerTextureKeyForPresentation(1, 0, false, 0, () => true)).toBe('player_idle_right');
    expect(playerMovedBetween({ x: 120, y: 256 }, { x: 120, y: 256 })).toBe(false);
    expect(playerMovedBetween({ x: 120, y: 256 }, { x: 121, y: 256 })).toBe(true);
    expect(playerMovedBetween({ x: 120, y: 256 }, { x: 120, y: 255 })).toBe(true);
  });

  it('uses the four-step 7.5 FPS directional walk sequence and immediately follows facing changes', () => {
    const frameDuration = 1000 / PLAYER_WALK_FRAME_RATE;
    const exists = () => true;
    for (const [facingX, facingY, direction] of [
      [0, 1, 'down'], [0, -1, 'up'], [-1, 0, 'left'], [1, 0, 'right'],
    ] as const) {
      expect(playerTextureKeyForPresentation(facingX, facingY, true, 0, exists)).toBe(`player_walk_${direction}_01`);
      expect(playerTextureKeyForPresentation(facingX, facingY, true, frameDuration, exists)).toBe(`player_idle_${direction}`);
      expect(playerTextureKeyForPresentation(facingX, facingY, true, frameDuration * 2, exists)).toBe(`player_walk_${direction}_02`);
      expect(playerTextureKeyForPresentation(facingX, facingY, true, frameDuration * 3, exists)).toBe(`player_idle_${direction}`);
    }
    expect(playerTextureKeyForPresentation(0, -1, true, 0, exists)).toBe('player_walk_up_01');
  });

  it('falls back from a missing walk frame to the matching idle, then to the procedural sprite', () => {
    const onlyIdleExists = (key: string) => key === 'player_idle_left';
    expect(playerTextureKeyForPresentation(-1, 0, true, 0, onlyIdleExists)).toBe('player_idle_left');
    expect(playerTextureKeyForPresentation(-1, 0, false, 0, onlyIdleExists)).toBe('player_idle_left');
    expect(playerTextureKeyForPresentation(1, 0, true, 0, () => false)).toBe('player');
  });
});
