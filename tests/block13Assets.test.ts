import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  BLOCK13_ASSET_MANIFEST,
  block13BranchPlacements,
  block13HasOffsetThreshold,
  block13HubRingPlacements,
  block13OverlayAssetAt,
  block13SurfaceAssetAt,
  block13WallEdgeRotations,
} from '../src/game/block13Assets';

describe('Block 13 authored environment assets', () => {
  it('ships exact-size RGBA PNGs for the frames in the loader manifest', () => {
    for (const asset of Object.values(BLOCK13_ASSET_MANIFEST)) {
      const png = readFileSync(new URL(`../public${asset.path}`, import.meta.url));
      expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(png.readUInt32BE(16)).toBe(asset.width);
      expect(png.readUInt32BE(20)).toBe(asset.height);
      expect(png[25]).toBe(6); // PNG color type 6: RGBA
    }
    expect('wall_variant_01' in BLOCK13_ASSET_MANIFEST).toBe(true);
    expect(Object.keys(BLOCK13_ASSET_MANIFEST)).toHaveLength(21);
    for (const name of ['wall_echo_symbol', 'threshold_offset_echo', 'wall_repeater_panel', 'exit_echo_frame'] as const) {
      const { width, height } = BLOCK13_ASSET_MANIFEST[name];
      const png = readFileSync(new URL(`../public${BLOCK13_ASSET_MANIFEST[name].path}`, import.meta.url));
      const chunks: Buffer[] = [];
      let offset = 8;
      while (offset < png.length) {
        const length = png.readUInt32BE(offset);
        const type = png.toString('ascii', offset + 4, offset + 8);
        if (type === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
        offset += length + 12;
        if (type === 'IEND') break;
      }
      const raw = inflateSync(Buffer.concat(chunks));
      const stride = width * 4 + 1;
      expect(Array.from({ length: height }, (_, y) => raw[y * stride]).every(filter => filter === 0)).toBe(true);
      const alpha = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => raw[y * stride + 1 + x * 4 + 3])).flat();
      expect(alpha.some(value => value === 0)).toBe(true);
      expect(alpha.some(value => value === 255)).toBe(true);
    }
  });

  it('selects sparse Block 13 surfaces and decorations deterministically without affecting other floors', () => {
    expect(block13SurfaceAssetAt(1, 4, 8, true)).toBeNull();
    expect(block13OverlayAssetAt(4, 4, 8, false)).toBeNull();
    let wallBaseCount = 0;
    let wallVariantCount = 0;
    let repeatedPanelCount = 0;
    let impossibleSeamCount = 0;
    let echoFloorCount = 0;
    let foldedWallCount = 0;
    let echoSymbolCount = 0;
    let repeaterCount = 0;
    for (let y = 0; y < 37; y++) {
      for (let x = 0; x < 43; x++) {
        const walkable = (x * 7 + y * 11) % 3 !== 0;
        const surface = block13SurfaceAssetAt(0, x, y, walkable);
        expect(surface).toBe(block13SurfaceAssetAt(0, x, y, walkable));
        const overlay = block13OverlayAssetAt(0, x, y, walkable);
        expect(overlay).toBe(block13OverlayAssetAt(0, x, y, walkable));
        if (walkable && surface === 'floor_echo_loop') echoFloorCount++;
        if (!walkable) {
          if (surface === 'wall_base') wallBaseCount++;
          if (surface === 'wall_variant_01') wallVariantCount++;
          if (surface === 'wall_folded_plane') foldedWallCount++;
          if (surface === 'repeated_panel') repeatedPanelCount++;
          if (overlay === 'repeated_panel') repeatedPanelCount++;
          if (overlay === 'impossible_wall_seam') impossibleSeamCount++;
          if (overlay === 'wall_echo_symbol') echoSymbolCount++;
          if (overlay === 'wall_repeater_panel') repeaterCount++;
        }
      }
    }
    expect(wallBaseCount).toBeGreaterThan(0);
    expect(wallVariantCount).toBeGreaterThan(0);
    expect(repeatedPanelCount).toBeGreaterThan(0);
    expect(impossibleSeamCount).toBeGreaterThan(0);
    expect(echoFloorCount).toBeGreaterThan(0);
    expect(foldedWallCount).toBeGreaterThan(0);
    expect(echoSymbolCount).toBeGreaterThan(0);
    expect(repeaterCount).toBeGreaterThan(0);
  });

  it('uses existing walkable neighbors only to orient shallow wall-edge art', () => {
    expect(block13WallEdgeRotations({ up: false, right: false, down: true, left: false })).toEqual([0]);
    expect(block13WallEdgeRotations({ up: true, right: false, down: false, left: true })).toEqual([Math.PI / 2, Math.PI]);
    expect(block13WallEdgeRotations({ up: false, right: false, down: false, left: false })).toEqual([]);
  });

  it('places the hub accent segments at fixed tile-aligned offsets', () => {
    expect(block13HubRingPlacements()).toEqual([
      { xOffset: -96, yOffset: 0, asset: 'ring_segment', rotation: Math.PI },
      { xOffset: 0, yOffset: -96, asset: 'broken_ring_segment', rotation: Math.PI / 2 },
      { xOffset: 96, yOffset: 0, asset: 'ring_segment', rotation: 0 },
      { xOffset: 0, yOffset: 96, asset: 'broken_ring_segment', rotation: -Math.PI / 2 },
    ]);
  });

  it('derives branch marks from the existing hub and objective coordinates', () => {
    expect(block13BranchPlacements([20, 18], [[4, 12], [29, 18], [20, 34]])).toEqual([
      { x: 15, y: 18, asset: 'branch_mark', rotation: Math.PI / 2 },
      { x: 25, y: 18, asset: 'branch_mark', rotation: Math.PI / 2 },
      { x: 20, y: 22, asset: 'radial_mark', rotation: 0 },
    ]);
  });

  it('places offset threshold echoes deterministically from existing door coordinates', () => {
    const placements = Array.from({ length: 80 }, (_, i) => block13HasOffsetThreshold(i % 20, Math.floor(i / 20)));
    expect(placements).toEqual(Array.from({ length: 80 }, (_, i) => block13HasOffsetThreshold(i % 20, Math.floor(i / 20))));
    expect(placements.some(Boolean)).toBe(true);
    expect(placements.some(value => !value)).toBe(true);
  });

  it('composes the larger exit echo frame around the existing exit coordinate in the static texture', () => {
    const floorScene = readFileSync(new URL('../src/game/scenes/FloorScene.ts', import.meta.url), 'utf8');
    expect(floorScene).toContain("drawAsset('exit_echo_frame', this.floorData.exit[0] * this.tileSize + 16, this.floorData.exit[1] * this.tileSize + 16)");
    expect(floorScene).toContain('const width = asset?.width ?? this.tileSize;');
    expect(floorScene).toContain('const height = asset?.height ?? this.tileSize;');
    const bootScene = readFileSync(new URL('../src/game/scenes/BootScene.ts', import.meta.url), 'utf8');
    expect(bootScene).toContain('for (const asset of Object.values(BLOCK13_ASSET_MANIFEST))');
  });
});
