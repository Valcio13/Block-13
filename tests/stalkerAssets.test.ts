import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  inferStalkerVisualFacing,
  STALKER_IDLE_ASSET_MANIFEST,
  STALKER_WALK_ASSET_MANIFEST,
  STALKER_WALK_FRAME_RATE,
  stalkerMovedBetween,
  stalkerTextureKeyForFacing,
  stalkerTextureKeyForPresentation,
} from '../src/game/stalkerAssets';

function pngAlphaSamples(png: Buffer): number[] {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const compressed: Buffer[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') compressed.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  const raw = inflateSync(Buffer.concat(compressed));
  const stride = width * 4;
  let prior = Buffer.alloc(stride);
  const alphas: number[] = [];
  let offset = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[offset++];
    const row = Buffer.from(raw.subarray(offset, offset + stride));
    offset += stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= 4 ? row[i - 4] : 0;
      const above = prior[i];
      const upperLeft = i >= 4 ? prior[i - 4] : 0;
      if (filter === 1) row[i] = (row[i] + left) & 255;
      else if (filter === 2) row[i] = (row[i] + above) & 255;
      else if (filter === 3) row[i] = (row[i] + Math.floor((left + above) / 2)) & 255;
      else if (filter === 4) {
        const p = left + above - upperLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - above), pc = Math.abs(p - upperLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? above : upperLeft;
        row[i] = (row[i] + predictor) & 255;
      } else if (filter !== 0) throw new Error(`Unsupported PNG filter: ${filter}`);
    }
    for (let i = 3; i < stride; i += 4) alphas.push(row[i]);
    prior = row;
  }
  return alphas;
}

describe('authored Stalker idle presentation assets', () => {
  it('registers all four exact-size transparent RGBA idle PNGs', () => {
    expect(Object.keys(STALKER_IDLE_ASSET_MANIFEST)).toEqual(['down', 'up', 'left', 'right']);
    expectProductionPngs(Object.values(STALKER_IDLE_ASSET_MANIFEST));
  });

  it('registers all eight exact-size transparent RGBA walking PNGs', () => {
    expect(Object.keys(STALKER_WALK_ASSET_MANIFEST)).toHaveLength(8);
    expectProductionPngs(Object.values(STALKER_WALK_ASSET_MANIFEST));
  });

  it('maps each inferred cardinal direction to its own authored texture', () => {
    for (const direction of ['down', 'up', 'left', 'right'] as const) {
      expect(stalkerTextureKeyForFacing(direction, () => true)).toBe(STALKER_IDLE_ASSET_MANIFEST[direction].key);
    }
  });

  it('infers the dominant axis and uses horizontal facing for equal diagonals', () => {
    const origin = Object.freeze({ x: 100, y: 100 });
    expect(inferStalkerVisualFacing(origin, { x: 100, y: 110 })).toBe('down');
    expect(inferStalkerVisualFacing(origin, { x: 100, y: 90 })).toBe('up');
    expect(inferStalkerVisualFacing(origin, { x: 90, y: 100 })).toBe('left');
    expect(inferStalkerVisualFacing(origin, { x: 110, y: 100 })).toBe('right');
    expect(inferStalkerVisualFacing(origin, { x: 110, y: 110 })).toBe('right');
    expect(inferStalkerVisualFacing(origin, { x: 110, y: 120 })).toBe('down');
    expect(origin).toEqual({ x: 100, y: 100 });
  });

  it('retains the previous visual facing while stationary and defaults deterministically to down', () => {
    const same = { x: 32, y: 52 };
    expect(inferStalkerVisualFacing(same, same)).toBe('down');
    expect(inferStalkerVisualFacing(same, same, 'left')).toBe('left');
  });

  it('uses the procedural texture if a directional authored texture is unavailable', () => {
    expect(stalkerTextureKeyForFacing('up', () => false)).toBe('stalker');
  });

  it('animates in the requested four-step sequence at 6.5 FPS for all directions', () => {
    expect(STALKER_WALK_FRAME_RATE).toBe(6.5);
    const step = 1000 / STALKER_WALK_FRAME_RATE;
    const exists = () => true;
    for (const direction of ['down', 'up', 'left', 'right'] as const) {
      expect(stalkerTextureKeyForPresentation(direction, true, 0, exists)).toBe(`stalker_walk_${direction}_01`);
      expect(stalkerTextureKeyForPresentation(direction, true, step, exists)).toBe(`stalker_idle_${direction}`);
      expect(stalkerTextureKeyForPresentation(direction, true, step * 2, exists)).toBe(`stalker_walk_${direction}_02`);
      expect(stalkerTextureKeyForPresentation(direction, true, step * 3, exists)).toBe(`stalker_idle_${direction}`);
      expect(stalkerTextureKeyForPresentation(direction, false, step * 2, exists)).toBe(`stalker_idle_${direction}`);
    }
  });

  it('starts a changed direction at that direction’s first walk frame', () => {
    expect(stalkerTextureKeyForPresentation('left', true, 0, () => true)).toBe('stalker_walk_left_01');
    expect(stalkerTextureKeyForPresentation('up', true, 0, () => true)).toBe('stalker_walk_up_01');
  });

  it('falls back from a missing walk frame to the matching idle, then to procedural art', () => {
    const idleOnly = (key: string) => key === 'stalker_idle_right';
    expect(stalkerTextureKeyForPresentation('right', true, 0, idleOnly)).toBe('stalker_idle_right');
    expect(stalkerTextureKeyForPresentation('right', false, 0, () => false)).toBe('stalker');
  });

  it('detects movement without mutating authoritative position snapshots', () => {
    const previous = Object.freeze({ x: 10, y: 20 });
    const current = Object.freeze({ x: 10, y: 21 });
    expect(stalkerMovedBetween(previous, current)).toBe(true);
    expect(stalkerMovedBetween(current, current)).toBe(false);
    expect(inferStalkerVisualFacing(previous, current, 'left')).toBe('down');
    expect(previous).toEqual({ x: 10, y: 20 });
    expect(current).toEqual({ x: 10, y: 21 });
  });
});

function expectProductionPngs(assets: readonly { path: string }[]) {
  for (const asset of assets) {
    const png = readFileSync(`public${asset.path}`);
    expect(png.toString('ascii', 1, 4)).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(32);
    expect(png.readUInt32BE(20)).toBe(52);
    expect(png[25]).toBe(6); // PNG color type 6 is RGBA.
    expect(png[24]).toBe(8); // Eight bits per RGBA channel.
    const alpha = pngAlphaSamples(png);
    expect(alpha.some(value => value === 0)).toBe(true);
    expect(alpha.some(value => value > 0)).toBe(true);
  }
}
