/** Development-only Block 3 art inputs. These files stay under art-experiments/. */
export const BLOCK3_REFINED_EXPERIMENT_ASSETS = [
  { key: 'dev_b3_floor_primary', file: 'floor_primary.png', width: 32, height: 32 },
  { key: 'dev_b3_floor_secondary', file: 'floor_secondary.png', width: 32, height: 32 },
  { key: 'dev_b3_floor_damaged', file: 'floor_damaged.png', width: 32, height: 32 },
  { key: 'dev_b3_floor_light_wear', file: 'floor_light_wear.png', width: 32, height: 32 },
  { key: 'dev_b3_floor_moderate_wear', file: 'floor_moderate_wear.png', width: 32, height: 32 },
  { key: 'dev_b3_wall_primary', file: 'wall_primary.png', width: 32, height: 32 },
  { key: 'dev_b3_wall_damaged', file: 'wall_damaged.png', width: 32, height: 32 },
  { key: 'dev_b3_wall_stained', file: 'wall_stained.png', width: 32, height: 32 },
  { key: 'dev_b3_wall_patch', file: 'wall_patch.png', width: 32, height: 32 },
  { key: 'dev_b3_room_notice', file: 'room_notice.png', width: 32, height: 32 },
  { key: 'dev_b3_wall_floor_transition', file: 'wall_floor_transition.png', width: 32, height: 32 },
  { key: 'dev_b3_door_threshold', file: 'door_threshold.png', width: 32, height: 32 },
  { key: 'dev_b3_detail_01', file: 'environmental_detail_01.png', width: 32, height: 32 },
  { key: 'dev_b3_detail_02', file: 'environmental_detail_02.png', width: 32, height: 32 },
  { key: 'dev_b3_decorative_prop', file: 'decorative_prop.png', width: 32, height: 48 },
] as const;

export type Block3VisualMode = 'original' | 'refined';
export type Block3ExperimentTextureKey = typeof BLOCK3_REFINED_EXPERIMENT_ASSETS[number]['key'];

/** Stable clustered wear grades for the experiment; never reads or advances game RNG. */
export function block3SurfaceTextureAt(
  x: number,
  y: number,
  walkable: boolean,
  adjacentToWall: boolean,
  protectedTile = false,
): Block3ExperimentTextureKey {
  if (protectedTile) return walkable ? 'dev_b3_floor_primary' : 'dev_b3_wall_primary';
  const region = block3CoordinateHash(Math.floor(x / 3), Math.floor(y / 3));
  const tile = block3CoordinateHash(x, y);
  const roll = (region + tile % 17) % 100;
  if (walkable) {
    if (adjacentToWall && roll < 3) return 'dev_b3_floor_damaged';
    if (roll < 12) return 'dev_b3_floor_moderate_wear';
    if (roll < 31) return 'dev_b3_floor_light_wear';
    return 'dev_b3_floor_primary';
  }
  if (roll < 6) return 'dev_b3_wall_damaged';
  if (roll < 18) return 'dev_b3_wall_patch';
  if (roll < 38) return 'dev_b3_wall_stained';
  return 'dev_b3_wall_primary';
}

export function block3RoomNoticeTile(
  tiles: readonly (readonly boolean[])[],
  doors: readonly (readonly [number, number])[],
  protectedTiles: ReadonlySet<string>,
): readonly [number, number] | null {
  const candidates = new Set<string>();
  for (const [x, y] of doors) {
    for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]] as const) {
      const id = `${nx},${ny}`;
      if (tiles[ny]?.[nx] === false && !protectedTiles.has(id)) candidates.add(id);
    }
  }
  return [...candidates]
    .map(id => id.split(',').map(Number) as [number, number])
    .sort(([ax, ay], [bx, by]) => block3CoordinateHash(ax, ay) - block3CoordinateHash(bx, by))[0] ?? null;
}

function block3CoordinateHash(x: number, y: number): number {
  let hash = Math.imul((x + 0x632be5ab) | 0, 0x9e3779b1);
  hash = Math.imul(hash ^ (y + 0x85157af5), 0x85ebca77);
  return Math.imul(hash ^ 0x3b129a7d, 0x27d4eb2d) >>> 0;
}

const ASSET_TEXTURE_KEYS: Readonly<Record<string, Block3ExperimentTextureKey>> = {
  floor_base: 'dev_b3_floor_primary',
  floor_variant_01: 'dev_b3_floor_secondary',
  floor_variant_02: 'dev_b3_floor_secondary',
  floor_variant_03: 'dev_b3_floor_damaged',
  floor_variant_04: 'dev_b3_floor_damaged',
  wall_base: 'dev_b3_wall_primary',
  wall_variant_01: 'dev_b3_wall_damaged',
  wall_variant_02: 'dev_b3_wall_primary',
  wall_edge: 'dev_b3_wall_floor_transition',
  threshold: 'dev_b3_door_threshold',
  wall_peel_01: 'dev_b3_wall_damaged',
  wall_peel_02: 'dev_b3_wall_damaged',
  wall_spall_01: 'dev_b3_wall_damaged',
  damaged_floor_panel_01: 'dev_b3_floor_damaged',
  wall_lamp_01: 'dev_b3_detail_01',
  wall_vent_01: 'dev_b3_detail_02',
};

/** Used only while composing Block 3's static visual layer in a dev build. */
export function block3ExperimentTextureForAsset(asset: string): Block3ExperimentTextureKey | null {
  return ASSET_TEXTURE_KEYS[asset] ?? null;
}

export function nextBlock3VisualMode(mode: Block3VisualMode): Block3VisualMode {
  return mode === 'original' ? 'refined' : 'original';
}

export function block3VisualModeLabel(mode: Block3VisualMode): string {
  return mode === 'original' ? 'ORIGINAL' : 'REFINED';
}
