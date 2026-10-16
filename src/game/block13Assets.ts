import { assetPath } from '../core/assetPath';

/** Block 13 art assets and deterministic placement rules. Presentation only. */
export const BLOCK13_ASSET_MANIFEST = {
  floor_base: { key: 'b13_floor_base', path: assetPath('sprites/environment/blocks/block_13/floor_base.png'), width: 32, height: 32 },
  floor_variant_01: { key: 'b13_floor_variant_01', path: assetPath('sprites/environment/blocks/block_13/floor_variant_01.png'), width: 32, height: 32 },
  floor_variant_02: { key: 'b13_floor_variant_02', path: assetPath('sprites/environment/blocks/block_13/floor_variant_02.png'), width: 32, height: 32 },
  wall_base: { key: 'b13_wall_base', path: assetPath('sprites/environment/blocks/block_13/wall_base.png'), width: 32, height: 32 },
  wall_variant_01: { key: 'b13_wall_variant_01', path: assetPath('sprites/environment/blocks/block_13/wall_variant_01.png'), width: 32, height: 32 },
  wall_edge: { key: 'b13_wall_edge', path: assetPath('sprites/environment/blocks/block_13/wall_edge.png'), width: 32, height: 32 },
  threshold: { key: 'b13_threshold', path: assetPath('sprites/environment/blocks/block_13/threshold.png'), width: 32, height: 32 },
  ring_segment: { key: 'b13_ring_segment', path: assetPath('sprites/environment/blocks/block_13/ring_segment.png'), width: 32, height: 32 },
  broken_ring_segment: { key: 'b13_broken_ring_segment', path: assetPath('sprites/environment/blocks/block_13/broken_ring_segment.png'), width: 32, height: 32 },
  radial_mark: { key: 'b13_radial_mark', path: assetPath('sprites/environment/blocks/block_13/radial_mark.png'), width: 32, height: 32 },
  impossible_wall_seam: { key: 'b13_impossible_wall_seam', path: assetPath('sprites/environment/blocks/block_13/impossible_wall_seam.png'), width: 32, height: 32 },
  repeated_panel: { key: 'b13_repeated_panel', path: assetPath('sprites/environment/blocks/block_13/repeated_panel.png'), width: 32, height: 32 },
  branch_mark: { key: 'b13_branch_mark', path: assetPath('sprites/environment/blocks/block_13/branch_mark.png'), width: 32, height: 32 },
  corruption_overlay: { key: 'b13_corruption_overlay', path: assetPath('sprites/environment/blocks/block_13/corruption_overlay.png'), width: 32, height: 32 },
  hub_medallion: { key: 'b13_hub_medallion', path: assetPath('sprites/environment/blocks/block_13/hub_medallion.png'), width: 160, height: 160 },
  floor_echo_loop: { key: 'b13_floor_echo_loop', path: assetPath('sprites/environment/blocks/block_13/floor_echo_loop.png'), width: 32, height: 32 },
  wall_folded_plane: { key: 'b13_wall_folded_plane', path: assetPath('sprites/environment/blocks/block_13/wall_folded_plane.png'), width: 32, height: 32 },
  wall_echo_symbol: { key: 'b13_wall_echo_symbol', path: assetPath('sprites/environment/blocks/block_13/wall_echo_symbol.png'), width: 32, height: 32 },
  threshold_offset_echo: { key: 'b13_threshold_offset_echo', path: assetPath('sprites/environment/blocks/block_13/threshold_offset_echo.png'), width: 32, height: 32 },
  wall_repeater_panel: { key: 'b13_wall_repeater_panel', path: assetPath('sprites/environment/blocks/block_13/wall_repeater_panel.png'), width: 32, height: 32 },
  exit_echo_frame: { key: 'b13_exit_echo_frame', path: assetPath('sprites/environment/blocks/block_13/exit_echo_frame.png'), width: 64, height: 64 },
} as const;

export type Block13AssetName = keyof typeof BLOCK13_ASSET_MANIFEST;
export type Block13NeighborMask = { up: boolean; right: boolean; down: boolean; left: boolean };
export const BLOCK13_MAP_TEXTURE_KEY = 'b13_composed_environment';

/** Stable coordinate hash for cosmetic variation; never accesses a gameplay RNG stream. */
export function block13CoordinateHash(x: number, y: number): number {
  let hash = Math.imul((x + 0x632be5ab) | 0, 0x9e3779b1);
  hash = Math.imul(hash ^ (y + 0x85157af5), 0x85ebca77);
  return hash >>> 0;
}

/** Sparse offset doorway echo derived only from the existing door coordinate. */
export function block13HasOffsetThreshold(x: number, y: number): boolean {
  return block13CoordinateHash(x + 211, y - 73) % 3 === 0;
}

/** The base image for a Block 13 map cell, or null on every other floor. */
export function block13SurfaceAssetAt(
  floor: number,
  x: number,
  y: number,
  walkable: boolean,
): Block13AssetName | null {
  if (floor !== 0) return null;
  const hash = block13CoordinateHash(x, y);
  if (walkable) {
    if (hash % 43 === 0) return 'floor_echo_loop';
    if (hash % 31 === 0) return 'floor_variant_02';
    if (hash % 8 === 0) return 'floor_variant_01';
    return 'floor_base';
  }
  if (hash % 19 === 0) return 'wall_folded_plane';
  if (hash % 11 === 0) return 'wall_variant_01';
  return 'wall_base';
}

/** Sparse per-cell ornament, intentionally kept away from simulation state. */
export function block13OverlayAssetAt(floor: number, x: number, y: number, walkable: boolean): Block13AssetName | null {
  if (floor !== 0) return null;
  const hash = block13CoordinateHash(x + 53, y - 29);
  if (!walkable && hash % 127 === 0) return 'wall_echo_symbol';
  if (walkable && hash % 89 === 0) return 'corruption_overlay';
  if (!walkable && hash % 83 === 0) return 'impossible_wall_seam';
  if (!walkable && hash % 137 === 0) return 'repeated_panel';
  if (!walkable && hash % 149 === 0) return 'wall_repeater_panel';
  return null;
}

/** Wall-edge art sits just inside existing solid cells; this never changes occupancy. */
export function block13WallEdgeRotations(neighbors: Block13NeighborMask): number[] {
  const rotations: number[] = [];
  if (neighbors.down) rotations.push(0);
  if (neighbors.left) rotations.push(Math.PI / 2);
  if (neighbors.up) rotations.push(Math.PI);
  if (neighbors.right) rotations.push(-Math.PI / 2);
  return rotations;
}

export interface HubRingPlacement {
  xOffset: number;
  yOffset: number;
  asset: 'ring_segment' | 'broken_ring_segment';
  rotation: number;
}

/** Four grid-aligned accent segments outside the 160px hub medallion. */
export function block13HubRingPlacements(): readonly HubRingPlacement[] {
  return [
    { xOffset: -96, yOffset: 0, asset: 'ring_segment', rotation: Math.PI },
    { xOffset: 0, yOffset: -96, asset: 'broken_ring_segment', rotation: Math.PI / 2 },
    { xOffset: 96, yOffset: 0, asset: 'ring_segment', rotation: 0 },
    { xOffset: 0, yOffset: 96, asset: 'broken_ring_segment', rotation: -Math.PI / 2 },
  ];
}

export interface Block13BranchPlacement {
  x: number;
  y: number;
  asset: 'branch_mark' | 'radial_mark';
  rotation: number;
}

/** Derive the first tile outside the existing H-then-V hub branches. */
export function block13BranchPlacements(
  hub: [number, number],
  targets: readonly [number, number][],
): Block13BranchPlacement[] {
  return targets.map(([targetX, targetY], index) => {
    const dx = targetX - hub[0];
    const dy = targetY - hub[1];
    const horizontalFirst = dx !== 0;
    return {
      x: horizontalFirst ? hub[0] + Math.sign(dx) * 5 : hub[0],
      y: horizontalFirst ? hub[1] : hub[1] + Math.sign(dy) * 4,
      asset: index === targets.length - 1 ? 'radial_mark' : 'branch_mark',
      rotation: horizontalFirst ? Math.PI / 2 : 0,
    };
  });
}
