import type { SearchableType } from '../core/floor';
import { architecturalMarkAt, tileDressingAt } from '../core/visualAtmosphere';
import { assetPath } from '../core/assetPath';

/** Authored environment assets shared by the ordinary floors, with sparse block overlays. */
export const ORDINARY_ENVIRONMENT_ASSET_MANIFEST = {
  floor_base: { key: 'env_floor_base', path: assetPath('sprites/environment/shared/floor_base.png'), width: 32, height: 32 },
  floor_variant_01: { key: 'env_floor_variant_01', path: assetPath('sprites/environment/shared/floor_variant_01.png'), width: 32, height: 32 },
  floor_variant_02: { key: 'env_floor_variant_02', path: assetPath('sprites/environment/shared/floor_variant_02.png'), width: 32, height: 32 },
  floor_variant_03: { key: 'env_floor_variant_03', path: assetPath('sprites/environment/shared/floor_variant_03.png'), width: 32, height: 32 },
  floor_variant_04: { key: 'env_floor_variant_04', path: assetPath('sprites/environment/shared/floor_variant_04.png'), width: 32, height: 32 },
  wall_base: { key: 'env_wall_base', path: assetPath('sprites/environment/shared/wall_base.png'), width: 32, height: 32 },
  wall_variant_01: { key: 'env_wall_variant_01', path: assetPath('sprites/environment/shared/wall_variant_01.png'), width: 32, height: 32 },
  wall_variant_02: { key: 'env_wall_variant_02', path: assetPath('sprites/environment/shared/wall_variant_02.png'), width: 32, height: 32 },
  wall_edge: { key: 'env_wall_edge', path: assetPath('sprites/environment/shared/wall_edge.png'), width: 32, height: 32 },
  threshold: { key: 'env_threshold', path: assetPath('sprites/environment/shared/threshold.png'), width: 32, height: 32 },
  container_cabinet: { key: 'env_container_cabinet', path: assetPath('sprites/environment/shared/container_cabinet.png'), width: 24, height: 24 },
  container_locker: { key: 'env_container_locker', path: assetPath('sprites/environment/shared/container_locker.png'), width: 24, height: 24 },
  container_box: { key: 'env_container_box', path: assetPath('sprites/environment/shared/container_box.png'), width: 24, height: 24 },
  container_drawer: { key: 'env_container_drawer', path: assetPath('sprites/environment/shared/container_drawer.png'), width: 24, height: 24 },
  container_wood_closed: { key: 'env_container_wood_closed', path: assetPath('sprites/environment/shared/containers/wood_closed.png'), width: 32, height: 32 },
  container_wood_open: { key: 'env_container_wood_open', path: assetPath('sprites/environment/shared/containers/wood_open.png'), width: 32, height: 32 },
  container_metal_closed: { key: 'env_container_metal_closed', path: assetPath('sprites/environment/shared/containers/metal_closed.png'), width: 32, height: 32 },
  container_metal_open: { key: 'env_container_metal_open', path: assetPath('sprites/environment/shared/containers/metal_open.png'), width: 32, height: 32 },
  container_supply_closed: { key: 'env_container_supply_closed', path: assetPath('sprites/environment/shared/containers/supply_closed.png'), width: 32, height: 32 },
  container_supply_open: { key: 'env_container_supply_open', path: assetPath('sprites/environment/shared/containers/supply_open.png'), width: 32, height: 32 },
  container_lockbox_closed: { key: 'env_container_lockbox_closed', path: assetPath('sprites/environment/shared/containers/lockbox_closed.png'), width: 32, height: 32 },
  container_lockbox_open: { key: 'env_container_lockbox_open', path: assetPath('sprites/environment/shared/containers/lockbox_open.png'), width: 32, height: 32 },
  wall_lamp_01: { key: 'env_wall_lamp_01', path: assetPath('sprites/environment/shared/props/wall_lamp_01.png'), width: 16, height: 16 },
  wall_vent_01: { key: 'env_wall_vent_01', path: assetPath('sprites/environment/shared/props/wall_vent_01.png'), width: 24, height: 16 },
  block4_wayfinding_plate_01: { key: 'env_b4_wayfinding_plate_01', path: assetPath('sprites/environment/blocks/block_4/block4_wayfinding_plate_01.png'), width: 32, height: 16 },
  wall_peel_01: { key: 'env_b3_wall_peel_01', path: assetPath('sprites/environment/blocks/block_3/wall_peel_01.png'), width: 32, height: 32 },
  wall_peel_02: { key: 'env_b3_wall_peel_02', path: assetPath('sprites/environment/blocks/block_3/wall_peel_02.png'), width: 32, height: 32 },
  maintenance_marking_01: { key: 'env_b2_maintenance_marking_01', path: assetPath('sprites/environment/blocks/block_2/maintenance_marking_01.png'), width: 32, height: 32 },
  breaker_panel_01: { key: 'env_b2_breaker_panel_01', path: assetPath('sprites/environment/blocks/block_2/breaker_panel_01.png'), width: 24, height: 32 },
  hazard_floor_marking_01: { key: 'env_b2_hazard_floor_marking_01', path: assetPath('sprites/environment/blocks/block_2/hazard_floor_marking_01.png'), width: 32, height: 32 },
  fracture_overlay_01: { key: 'env_b1_fracture_overlay_01', path: assetPath('sprites/environment/blocks/block_1/fracture_overlay_01.png'), width: 32, height: 32 },
  wall_spall_01: { key: 'env_b1_wall_spall_01', path: assetPath('sprites/environment/blocks/block_1/wall_spall_01.png'), width: 32, height: 32 },
  damaged_floor_panel_01: { key: 'env_b1_damaged_floor_panel_01', path: assetPath('sprites/environment/blocks/block_1/damaged_floor_panel_01.png'), width: 32, height: 32 },
  floor_service_grate: { key: 'env_b2_floor_service_grate', path: assetPath('sprites/environment/blocks/block_2/floor_service_grate.png'), width: 32, height: 32 },
  wall_service_manifold: { key: 'env_b2_wall_service_manifold', path: assetPath('sprites/environment/blocks/block_2/wall_service_manifold.png'), width: 32, height: 32 },
  wall_pipe_leak: { key: 'env_b2_wall_pipe_leak', path: assetPath('sprites/environment/blocks/block_2/wall_pipe_leak.png'), width: 32, height: 32 },
  wall_vent_cage: { key: 'env_b2_wall_vent_cage', path: assetPath('sprites/environment/blocks/block_2/wall_vent_cage.png'), width: 32, height: 32 },
  floor_spalled_slab: { key: 'env_b1_floor_spalled_slab', path: assetPath('sprites/environment/blocks/block_1/floor_spalled_slab.png'), width: 32, height: 32 },
  wall_exposed_lath: { key: 'env_b1_wall_exposed_lath', path: assetPath('sprites/environment/blocks/block_1/wall_exposed_lath.png'), width: 32, height: 32 },
  floor_rubble_overlay: { key: 'env_b1_floor_rubble_overlay', path: assetPath('sprites/environment/blocks/block_1/floor_rubble_overlay.png'), width: 32, height: 32 },
  wall_torn_notice: { key: 'env_b1_wall_torn_notice', path: assetPath('sprites/environment/blocks/block_1/wall_torn_notice.png'), width: 32, height: 32 },
  breaker_panel_faulty: { key: 'env_b2_breaker_panel_faulty', path: assetPath('sprites/environment/blocks/block_2/breaker_panel_faulty.png'), width: 24, height: 32 },
  cable_junction: { key: 'env_b2_cable_junction', path: assetPath('sprites/environment/blocks/block_2/cable_junction.png'), width: 32, height: 32 },
  water_damaged_wall: { key: 'env_b2_water_damaged_wall', path: assetPath('sprites/environment/blocks/block_2/water_damaged_wall.png'), width: 32, height: 32 },
  abandoned_belongings: { key: 'env_b1_abandoned_belongings', path: assetPath('sprites/environment/blocks/block_1/abandoned_belongings.png'), width: 32, height: 32 },
  failed_repair_patch: { key: 'env_b1_failed_repair_patch', path: assetPath('sprites/environment/blocks/block_1/failed_repair_patch.png'), width: 32, height: 32 },
  departure_notice: { key: 'env_b1_departure_notice', path: assetPath('sprites/environment/blocks/block_1/departure_notice.png'), width: 32, height: 32 },
} as const;

export type OrdinaryEnvironmentAssetName = keyof typeof ORDINARY_ENVIRONMENT_ASSET_MANIFEST;
export type OrdinarySurfaceAssetName = 'floor_base' | 'floor_variant_01' | 'floor_variant_02' | 'floor_variant_03' | 'floor_variant_04' | 'wall_base' | 'wall_variant_01' | 'wall_variant_02' | 'floor_service_grate' | 'wall_service_manifold' | 'floor_spalled_slab' | 'wall_exposed_lath';
export type OrdinaryOverlayAssetName = 'block4_wayfinding_plate_01' | 'wall_peel_01' | 'wall_peel_02' | 'maintenance_marking_01' | 'breaker_panel_01' | 'hazard_floor_marking_01' | 'fracture_overlay_01' | 'wall_spall_01' | 'damaged_floor_panel_01' | 'wall_lamp_01' | 'wall_vent_01' | 'wall_pipe_leak' | 'wall_vent_cage' | 'floor_rubble_overlay' | 'wall_torn_notice';

export type OrdinaryThresholdStyle = 'orderly' | 'worn' | 'hazard' | 'fracture';
export interface OrdinaryThresholdTreatment { style: OrdinaryThresholdStyle; color: number; alpha: number; }

/** Surface-only door paint that makes the deterioration progression legible. */
export function ordinaryThresholdTreatment(floor: number): OrdinaryThresholdTreatment | null {
  switch (floor) {
    case 4: return { style: 'orderly', color: 0xb9c5bc, alpha: 0.54 };
    case 3: return { style: 'worn', color: 0xb08a68, alpha: 0.48 };
    case 2: return { style: 'hazard', color: 0xd1a65d, alpha: 0.72 };
    case 1: return { style: 'fracture', color: 0xa27494, alpha: 0.56 };
    default: return null;
  }
}

type ProductionContainerKind = 'wood' | 'metal' | 'supply' | 'lockbox';

function productionContainerKindAt(floor: number, objectType: SearchableType, x = 0, y = 0): ProductionContainerKind | null {
  if (objectType === 'maintenance_lockbox') return 'lockbox';
  if (objectType === 'mimic') return null;
  if (objectType === 'box') return 'wood';
  if (objectType === 'cabinet') return 'metal';
  if (objectType === 'locker') return 'supply';
  // Drawers use a stable coordinate-derived art choice, so the same map always
  // looks the same and cosmetic variety never consumes simulation RNG.
  return (['wood', 'metal', 'supply'] as const)[ordinaryEnvironmentCoordinateHash(floor, x, y) % 3];
}

/** Stable presentation hash; it never reads or advances a gameplay RNG stream. */
export function ordinaryEnvironmentCoordinateHash(floor: number, x: number, y: number): number {
  let hash = Math.imul((x + 0x632be5ab) | 0, 0x9e3779b1);
  hash = Math.imul(hash ^ (y + 0x85157af5), 0x85ebca77);
  return Math.imul(hash ^ (floor + 17), 0x27d4eb2d) >>> 0;
}

const FLOOR_BASE: OrdinarySurfaceAssetName = 'floor_base';
const WALL_BASE: OrdinarySurfaceAssetName = 'wall_base';

type WeightedSurface = readonly [asset: OrdinarySurfaceAssetName, weight: number];
type SurfacePool = { floor: readonly WeightedSurface[]; wall: readonly WeightedSurface[] };

/** Block-specific authored surface vocabularies; weights are candidate shares before neighbor thinning. */
export const ORDINARY_SURFACE_POOLS: Readonly<Record<1 | 2 | 3 | 4, SurfacePool>> = {
  4: {
    floor: [['floor_base', 84], ['floor_variant_01', 16]],
    wall: [['wall_base', 82], ['wall_variant_02', 18]],
  },
  3: {
    floor: [['floor_base', 78], ['floor_variant_01', 8], ['floor_variant_02', 6], ['floor_variant_03', 8]],
    wall: [['wall_base', 78], ['wall_variant_01', 16], ['wall_variant_02', 6]],
  },
  2: {
    // Block 2 is industrial but still legible: let the shared base tiles
    // carry most of the room so authored maintenance details read as accents.
    floor: [['floor_base', 90], ['floor_variant_02', 7], ['floor_service_grate', 3]],
    wall: [['wall_base', 88], ['wall_variant_01', 6], ['wall_variant_02', 2], ['wall_service_manifold', 4]],
  },
  1: {
    floor: [['floor_base', 38], ['floor_variant_01', 14], ['floor_variant_02', 20], ['floor_variant_03', 16], ['floor_spalled_slab', 12]],
    wall: [['wall_base', 47], ['wall_variant_01', 25], ['wall_variant_02', 12], ['wall_exposed_lath', 16]],
  },
};

function coordinateKey(x: number, y: number) { return `${x},${y}`; }

function ordinarySurfaceCandidateAt(floor: number, x: number, y: number, walkable: boolean, protectedTile: boolean): OrdinarySurfaceAssetName | null {
  if (floor < 1 || floor > 4) return null;
  const base = walkable ? FLOOR_BASE : WALL_BASE;
  if (protectedTile) return base;
  const roll = ordinaryEnvironmentCoordinateHash(floor, x, y) % 100;
  const pool = walkable ? ORDINARY_SURFACE_POOLS[floor as 1 | 2 | 3 | 4].floor : ORDINARY_SURFACE_POOLS[floor as 1 | 2 | 3 | 4].wall;
  let boundary = 0;
  for (const [asset, weight] of pool) {
    boundary += weight;
    if (roll < boundary) return asset;
  }
  return base;
}

/** Tile-aligned ordinary floor/wall selection, with protected tiles forced to their base. */
export function ordinarySurfaceAssetsForMap(
  floor: number,
  tiles: readonly (readonly boolean[])[],
  protectedTiles: ReadonlySet<string> = new Set(),
): OrdinarySurfaceAssetName[][] {
  const candidates = tiles.map((row, y) => row.map((walkable, x) => ordinarySurfaceCandidateAt(
    floor, x, y, walkable, protectedTiles.has(coordinateKey(x, y)),
  )));
  return tiles.map((row, y) => row.map((walkable, x) => {
    const candidate = candidates[y][x];
    if (!candidate || candidate === (walkable ? FLOOR_BASE : WALL_BASE)) return candidate ?? (walkable ? FLOOR_BASE : WALL_BASE);
    const priority = ordinaryEnvironmentCoordinateHash(floor, x, y);
    // Isolate matching distinctive tiles in all directions; this avoids
    // diagonal checker clusters as well as the former cardinal-only runs.
    for (const [nx, ny] of [[x - 1, y - 1], [x, y - 1], [x + 1, y - 1], [x - 1, y], [x + 1, y], [x - 1, y + 1], [x, y + 1], [x + 1, y + 1]] as const) {
      if (candidates[ny]?.[nx] !== candidate) continue;
      const neighborPriority = ordinaryEnvironmentCoordinateHash(floor, nx, ny);
      if (neighborPriority < priority || (neighborPriority === priority && (ny < y || (ny === y && nx < x)))) return walkable ? FLOOR_BASE : WALL_BASE;
    }
    return candidate;
  }));
}

/** Coordinate-derived shared tile selection for Blocks 4–1; null on Block 13. */
export function ordinarySurfaceAssetAt(floor: number, x: number, y: number, walkable: boolean): OrdinarySurfaceAssetName | null {
  return ordinarySurfaceCandidateAt(floor, x, y, walkable, false);
}

/** Missing variants degrade to their shared base; null asks the scene to draw its procedural fallback. */
export function resolveOrdinarySurfaceAsset(
  requested: OrdinarySurfaceAssetName,
  assetExists: (name: OrdinarySurfaceAssetName) => boolean,
): OrdinarySurfaceAssetName | null {
  if (assetExists(requested)) return requested;
  if (requested === 'floor_variant_03' || requested === 'floor_variant_04') {
    if (assetExists('floor_variant_01')) return 'floor_variant_01';
  }
  if (requested === 'wall_variant_02' && assetExists('wall_variant_01')) return 'wall_variant_01';
  const base = requested.startsWith('floor_') ? 'floor_base' : 'wall_base';
  return assetExists(base) ? base : null;
}

/** Reuses existing deterministic architectural-mark choices for block-specific art. */
export function ordinaryOverlayAssetAt(floor: number, x: number, y: number, walkable: boolean): OrdinaryOverlayAssetName | null {
  const mark = architecturalMarkAt(floor, x, y, walkable);
  const hash = ordinaryEnvironmentCoordinateHash(floor, x, y);
  if (floor === 2 && !walkable && hash % 173 === 0) return 'wall_pipe_leak';
  if (floor === 2 && !walkable && hash % 211 === 0) return 'wall_vent_cage';
  if (floor === 1 && walkable && hash % 97 === 0) return 'floor_rubble_overlay';
  if (floor === 1 && !walkable && hash % 181 === 0) return 'wall_torn_notice';
  if (floor === 3 && !walkable && mark === 'peel') return hash % 2 === 0 ? 'wall_peel_01' : 'wall_peel_02';
  if (floor === 2 && walkable && mark === 'warning_repeat' && hash % 2 === 0) return 'hazard_floor_marking_01';
  if (floor === 2 && mark === 'warning_repeat') return 'maintenance_marking_01';
  if (floor === 1 && walkable && hash % 37 === 0) return 'damaged_floor_panel_01';
  if (floor === 1 && mark === 'fracture') {
    if (!walkable && hash % 2 === 0) return 'wall_spall_01';
    return 'fracture_overlay_01';
  }
  return null;
}

/** Deterministic overlay placement with identical authored marks separated locally. */
export function ordinaryOverlayAssetsForMap(
  floor: number,
  tiles: readonly (readonly boolean[])[],
  protectedTiles: ReadonlySet<string> = new Set(),
): (OrdinaryOverlayAssetName | null)[][] {
  const candidates = tiles.map((row, y) => row.map((walkable, x) => protectedTiles.has(coordinateKey(x, y))
    ? null
    : ordinaryOverlayAssetAt(floor, x, y, walkable)));
  return tiles.map((row, y) => row.map((_walkable, x) => {
    const candidate = candidates[y][x];
    if (!candidate) return null;
    const priority = ordinaryEnvironmentCoordinateHash(floor, x, y);
    for (const [nx, ny] of [[x - 1, y - 1], [x, y - 1], [x + 1, y - 1], [x - 1, y], [x + 1, y], [x - 1, y + 1], [x, y + 1], [x + 1, y + 1]] as const) {
      if (candidates[ny]?.[nx] !== candidate) continue;
      const neighborPriority = ordinaryEnvironmentCoordinateHash(floor, nx, ny);
      if (neighborPriority < priority || (neighborPriority === priority && (ny < y || (ny === y && nx < x)))) return null;
    }
    return candidate;
  }));
}

export function ordinaryOverlayPlacementAllowed(asset: OrdinaryOverlayAssetName, protectedTile: boolean, doorway: boolean): boolean {
  void asset;
  return !protectedTile && !doorway;
}

/** New art degrades to its approved predecessor or to existing procedural dressing. */
export function resolveOrdinaryOverlayAsset(
  requested: OrdinaryOverlayAssetName,
  assetExists: (name: OrdinaryOverlayAssetName) => boolean,
): OrdinaryOverlayAssetName | null {
  if (assetExists(requested)) return requested;
  const fallback: Partial<Record<OrdinaryOverlayAssetName, OrdinaryOverlayAssetName>> = {
    wall_peel_02: 'wall_peel_01',
    wall_spall_01: 'fracture_overlay_01',
    hazard_floor_marking_01: 'maintenance_marking_01',
    wall_pipe_leak: 'wall_vent_01',
    wall_vent_cage: 'wall_vent_01',
    floor_rubble_overlay: 'fracture_overlay_01',
    wall_torn_notice: 'fracture_overlay_01',
  };
  const replacement = fallback[requested];
  return replacement && assetExists(replacement) ? replacement : null;
}

export interface OrdinaryMapDecorationPlacement {
  asset: 'block4_wayfinding_plate_01' | 'wall_lamp_01' | 'wall_vent_01' | 'breaker_panel_01' | 'breaker_panel_faulty' | 'cable_junction' | 'water_damaged_wall' | 'abandoned_belongings' | 'failed_repair_patch' | 'departure_notice';
  x: number;
  y: number;
}

/** Sparse fixtures/panels based only on layout coordinates, cells and existing tile marks. */
export function ordinaryMapDecorationPlacements(
  floor: number,
  tiles: readonly (readonly boolean[])[],
  doors: readonly (readonly [number, number])[],
  protectedTiles: ReadonlySet<string>,
): OrdinaryMapDecorationPlacement[] {
  if (floor < 1 || floor > 4) return [];
  const doorTiles = new Set(doors.map(([x, y]) => coordinateKey(x, y)));
  const doorNeighbors = new Set<string>();
  for (const [x, y] of doors) for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]] as const) doorNeighbors.add(coordinateKey(nx, ny));
  const placements: OrdinaryMapDecorationPlacement[] = [];
  const reserved = new Set<string>([...protectedTiles, ...doorTiles]);
  const isWallOverlay = (x: number, y: number) => ordinaryOverlayAssetAt(floor, x, y, false) !== null
    || architecturalMarkAt(floor, x, y, false) !== null;
  const isEligibleWall = (x: number, y: number) => !tiles[y]?.[x]
    && ([tiles[y - 1]?.[x], tiles[y]?.[x + 1], tiles[y + 1]?.[x], tiles[y]?.[x - 1]].some(Boolean))
    && !reserved.has(coordinateKey(x, y))
    && !doorNeighbors.has(coordinateKey(x, y))
    && !isWallOverlay(x, y)
    && tileDressingAt(floor, x, y, false) !== 'pipe';

  // A short, deterministic list of plates near passages; never more than two.
  if (floor === 4) {
    const uniqueDoors = [...new Map(doors.map(([x, y]) => [coordinateKey(x, y), [x, y] as const])).values()];
    uniqueDoors.sort((a, b) => ordinaryEnvironmentCoordinateHash(floor, a[0], a[1]) - ordinaryEnvironmentCoordinateHash(floor, b[0], b[1]));
    for (const [doorX, doorY] of uniqueDoors) {
      const wall = [[doorX, doorY - 1], [doorX + 1, doorY], [doorX, doorY + 1], [doorX - 1, doorY]] as const;
      const chosen = wall.filter(([x, y]) => !tiles[y]?.[x]
        && !protectedTiles.has(coordinateKey(x, y))
        && !reserved.has(coordinateKey(x, y))
        && !isWallOverlay(x, y)
        && tileDressingAt(floor, x, y, false) !== 'pipe')
        .sort((a, b) => ordinaryEnvironmentCoordinateHash(floor, a[0], a[1]) - ordinaryEnvironmentCoordinateHash(floor, b[0], b[1]))[0];
      if (!chosen) continue;
      placements.push({ asset: 'block4_wayfinding_plate_01', x: chosen[0], y: chosen[1] });
      reserved.add(coordinateKey(chosen[0], chosen[1]));
      if (placements.length === 3) break;
    }
  }

  for (let y = 0; y < tiles.length; y++) for (let x = 0; x < tiles[y].length; x++) {
    if (!isEligibleWall(x, y)) continue;
    const roll = ordinaryEnvironmentCoordinateHash(floor, x, y) % 1000;
    const asset = roll < 40 ? 'wall_lamp_01'
      : roll < 72 ? 'wall_vent_01'
        : floor === 2 && roll < 96 ? 'breaker_panel_01'
          : null;
    if (!asset) continue;
    placements.push({ asset, x, y });
    reserved.add(coordinateKey(x, y));
  }

  // Block 2 story clusters: a few failing panels acquire adjacent exposed
  // wiring and damp staining. Every choice is ranked from immutable tile data.
  if (floor === 2) {
    const panels = placements.filter(item => item.asset === 'breaker_panel_01')
      .sort((a, b) => ordinaryEnvironmentCoordinateHash(floor, a.x, a.y) - ordinaryEnvironmentCoordinateHash(floor, b.x, b.y))
      .slice(0, 2);
    for (const panel of panels) {
      panel.asset = 'breaker_panel_faulty';
      const nearbyWalls: [number, number][] = [];
      for (let y = Math.max(0, panel.y - 2); y <= Math.min(tiles.length - 1, panel.y + 2); y++) {
        for (let x = Math.max(0, panel.x - 2); x <= Math.min((tiles[y]?.length ?? 0) - 1, panel.x + 2); x++) {
          if (Math.abs(x - panel.x) + Math.abs(y - panel.y) <= 2 && isEligibleWall(x, y)) nearbyWalls.push([x, y]);
        }
      }
      const choices = nearbyWalls
        .sort((a, b) => ordinaryEnvironmentCoordinateHash(floor, a[0], a[1]) - ordinaryEnvironmentCoordinateHash(floor, b[0], b[1]));
      if (choices[0]) {
        const [x, y] = choices[0]; placements.push({ asset: 'cable_junction', x, y }); reserved.add(coordinateKey(x, y));
      }
      const damp = choices.find(([x, y]) => !reserved.has(coordinateKey(x, y)));
      if (damp) {
        const [x, y] = damp; placements.push({ asset: 'water_damaged_wall', x, y }); reserved.add(coordinateKey(x, y));
      }
    }
  }

  // Block 1 abandonment cluster: belongings near a passage, with repair and
  // departure evidence on adjacent eligible wall cells.
  if (floor === 1) {
    const clusters = [...doors].sort((a, b) => ordinaryEnvironmentCoordinateHash(floor, a[0], a[1]) - ordinaryEnvironmentCoordinateHash(floor, b[0], b[1]));
    for (const [doorX, doorY] of clusters) {
      const floorChoices: [number, number][] = [];
      for (let y = Math.max(0, doorY - 3); y <= Math.min(tiles.length - 1, doorY + 3); y++) {
        for (let x = Math.max(0, doorX - 3); x <= Math.min((tiles[y]?.length ?? 0) - 1, doorX + 3); x++) {
          const id = coordinateKey(x, y);
          if (!tiles[y]?.[x] || Math.abs(x - doorX) + Math.abs(y - doorY) > 3 || reserved.has(id) || doorNeighbors.has(id)) continue;
          if (ordinaryOverlayAssetAt(floor, x, y, true) || tileDressingAt(floor, x, y, true) !== 'none') continue;
          floorChoices.push([x, y]);
        }
      }
      floorChoices.sort((a, b) => ordinaryEnvironmentCoordinateHash(floor, a[0], a[1]) - ordinaryEnvironmentCoordinateHash(floor, b[0], b[1]));
      const floorSpot = floorChoices[0];
      if (!floorSpot) continue;
      placements.push({ asset: 'abandoned_belongings', x: floorSpot[0], y: floorSpot[1] }); reserved.add(coordinateKey(...floorSpot));
      const walls: [number, number][] = [];
      for (let y = Math.max(0, floorSpot[1] - 3); y <= Math.min(tiles.length - 1, floorSpot[1] + 3); y++) {
        for (let x = Math.max(0, floorSpot[0] - 3); x <= Math.min((tiles[y]?.length ?? 0) - 1, floorSpot[0] + 3); x++) {
          const id = coordinateKey(x, y);
          const isAdjacentToWalkable = [tiles[y - 1]?.[x], tiles[y]?.[x + 1], tiles[y + 1]?.[x], tiles[y]?.[x - 1]].some(Boolean);
          // On Block 1 these details may accompany a fracture/spall mark to
          // form a deliberate repair/story cluster, but avoid notices and fixtures.
          const currentOverlay = ordinaryOverlayAssetAt(floor, x, y, false);
          if (tiles[y]?.[x] || !isAdjacentToWalkable || reserved.has(id) || doorNeighbors.has(id)
            || currentOverlay === 'wall_torn_notice' || tileDressingAt(floor, x, y, false) === 'pipe') continue;
          if (Math.abs(x - floorSpot[0]) + Math.abs(y - floorSpot[1]) <= 3) walls.push([x, y]);
        }
      }
      const wallChoices = walls
        .sort((a, b) => ordinaryEnvironmentCoordinateHash(floor, a[0], a[1]) - ordinaryEnvironmentCoordinateHash(floor, b[0], b[1]));
      if (wallChoices[0]) {
        const [x, y] = wallChoices[0]; placements.push({ asset: 'failed_repair_patch', x, y }); reserved.add(coordinateKey(x, y));
      }
      const notice = wallChoices.find(([x, y]) => !reserved.has(coordinateKey(x, y)));
      if (notice) {
        const [x, y] = notice; placements.push({ asset: 'departure_notice', x, y }); reserved.add(coordinateKey(x, y));
      }
      break;
    }
  }
  return placements;
}

/** Authored container textures are shared across Blocks 13 and 4–1; Mimics stay separate. */
export function ordinaryContainerAssetAt(floor: number, objectType: SearchableType, x = 0, y = 0, open = false): OrdinaryEnvironmentAssetName | null {
  if (floor !== 0 && (floor < 1 || floor > 4)) return null;
  const kind = productionContainerKindAt(floor, objectType, x, y);
  return kind ? `container_${kind}_${open ? 'open' : 'closed'}` as OrdinaryEnvironmentAssetName : null;
}

/** Resolve an authored container when loaded, otherwise return the existing generated texture key. */
export function resolveOrdinaryContainerTexture(
  floor: number,
  objectType: SearchableType,
  assetExists: (name: OrdinaryEnvironmentAssetName) => boolean,
  proceduralFallback: string,
  x = 0,
  y = 0,
  open = false,
): string {
  const asset = ordinaryContainerAssetAt(floor, objectType, x, y, open);
  return asset && assetExists(asset) ? ORDINARY_ENVIRONMENT_ASSET_MANIFEST[asset].key : proceduralFallback;
}
