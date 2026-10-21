import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { block13OverlayAssetAt, block13SurfaceAssetAt } from '../src/game/block13Assets';
import { generateFloor } from '../src/core/floor';
import { architecturalMarkAt, floorAmbientVisibility, floorFlashlightContrast, surfaceColorGrade, tileDressingAt } from '../src/core/visualAtmosphere';
import {
  ORDINARY_ENVIRONMENT_ASSET_MANIFEST,
  ORDINARY_SURFACE_POOLS,
  ordinaryContainerAssetAt,
  ordinaryEnvironmentCoordinateHash,
  ordinaryOverlayAssetAt,
  ordinaryOverlayAssetsForMap,
  ordinaryOverlayPlacementAllowed,
  ordinaryMapDecorationPlacements,
  ordinaryThresholdTreatment,
  ordinarySurfaceAssetsForMap,
  ordinarySurfaceAssetAt,
  resolveOrdinaryOverlayAsset,
  resolveOrdinaryContainerTexture,
  resolveOrdinarySurfaceAsset,
} from '../src/game/environmentAssets';

describe('ordinary authored environment assets', () => {
  it('gives each floor a restrained material hue and reduces generic wear on the familiar and nightmare floors', () => {
    const grades = Array.from({ length: 5 }, (_, floor) => surfaceColorGrade(floor, true));
    expect(new Set(grades.map(grade => grade.tint)).size).toBe(5);
    expect(grades.every(grade => grade.alpha > 0 && grade.alpha <= 0.16)).toBe(true);
    // This material treatment leaves the approved light radius/contrast profile intact.
    expect(floorAmbientVisibility(0)).toBe(0.42);
    expect(floorFlashlightContrast(0)).toBe(1.14);
    expect(floorFlashlightContrast(4)).toBe(1.02);

    const count = (floor: number, walkable: boolean, kind: 'stain' | 'crack') => {
      let total = 0;
      for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
        if (tileDressingAt(floor, x, y, walkable) === kind) total++;
      }
      return total;
    };
    expect(count(4, false, 'crack')).toBeLessThan(1300);
    expect(count(4, true, 'stain')).toBeLessThan(500);
    expect(count(0, false, 'crack')).toBeLessThan(1900);
    expect(count(0, true, 'crack')).toBeLessThan(600);
  });

  it('registers all 47 environment files with their exact native dimensions and PNG modes', () => {
    expect(Object.keys(ORDINARY_ENVIRONMENT_ASSET_MANIFEST)).toHaveLength(47);
    const transparent = new Set([
      'wall_lamp_01', 'wall_vent_01', 'block4_wayfinding_plate_01', 'wall_peel_01', 'wall_peel_02',
      'maintenance_marking_01', 'breaker_panel_01', 'hazard_floor_marking_01', 'fracture_overlay_01',
      'wall_spall_01', 'damaged_floor_panel_01', 'wall_pipe_leak', 'wall_vent_cage', 'floor_rubble_overlay', 'wall_torn_notice',
      'breaker_panel_faulty', 'cable_junction', 'water_damaged_wall', 'abandoned_belongings', 'failed_repair_patch', 'departure_notice',
      'container_wood_closed', 'container_wood_open',
      'container_metal_closed', 'container_metal_open', 'container_supply_closed', 'container_supply_open',
      'container_lockbox_closed', 'container_lockbox_open',
    ]);
    for (const [name, asset] of Object.entries(ORDINARY_ENVIRONMENT_ASSET_MANIFEST)) {
      const png = readFileSync(new URL(`../public${asset.path}`, import.meta.url));
      expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(png.readUInt32BE(16)).toBe(asset.width);
      expect(png.readUInt32BE(20)).toBe(asset.height);
      if (transparent.has(name)) expect(png[25]).toBe(6);
      else expect([2, 6]).toContain(png[25]);
    }
  });

  it('keeps the new Block 2 and Block 1 overlay silhouettes truly transparent', () => {
    for (const name of ['wall_pipe_leak', 'wall_vent_cage', 'floor_rubble_overlay', 'wall_torn_notice', 'breaker_panel_faulty', 'cable_junction', 'water_damaged_wall', 'abandoned_belongings', 'failed_repair_patch', 'departure_notice'] as const) {
      const asset = ORDINARY_ENVIRONMENT_ASSET_MANIFEST[name];
      const png = readFileSync(new URL(`../public${asset.path}`, import.meta.url));
      let offset = 8;
      const compressed: Buffer[] = [];
      while (offset < png.length) {
        const length = png.readUInt32BE(offset);
        const type = png.toString('ascii', offset + 4, offset + 8);
        if (type === 'IDAT') compressed.push(png.subarray(offset + 8, offset + 8 + length));
        offset += length + 12;
        if (type === 'IEND') break;
      }
      const raw = inflateSync(Buffer.concat(compressed));
      const stride = asset.width * 4 + 1;
      expect(Array.from({ length: asset.height }, (_, y) => raw[y * stride]).every(filter => filter === 0)).toBe(true);
      const alphaValues = Array.from({ length: asset.height }, (_, y) => Array.from({ length: asset.width }, (_, x) => raw[y * stride + 1 + x * 4 + 3])).flat();
      expect(alphaValues.some(alpha => alpha === 0)).toBe(true);
      expect(alphaValues.some(alpha => alpha === 255)).toBe(true);
    }
  });

  it('uses explicit block-specific pools, restrains Block 3 texture density, and protects important coordinates', () => {
    expect(ordinarySurfaceAssetAt(0, 7, 9, true)).toBeNull();
    expect(Object.keys(ORDINARY_SURFACE_POOLS).sort()).toEqual(['1', '2', '3', '4']);
    expect(ORDINARY_SURFACE_POOLS[4].floor.map(([name]) => name)).toEqual(['floor_base', 'floor_variant_01']);
    expect(ORDINARY_SURFACE_POOLS[4].wall.map(([name]) => name)).toEqual(['wall_base', 'wall_variant_02']);
    expect(ORDINARY_SURFACE_POOLS[3].floor.map(([name]) => name)).toEqual(['floor_base', 'floor_variant_01', 'floor_variant_02', 'floor_variant_03']);
    expect(ORDINARY_SURFACE_POOLS[3].wall.map(([name]) => name)).toEqual(['wall_base', 'wall_variant_01', 'wall_variant_02']);
    expect(ORDINARY_SURFACE_POOLS[2].floor.map(([name]) => name)).toEqual(['floor_base', 'floor_variant_02', 'floor_service_grate']);
    expect(ORDINARY_SURFACE_POOLS[2].floor[0]).toEqual(['floor_base', 90]);
    expect(ORDINARY_SURFACE_POOLS[2].wall.map(([name]) => name)).toEqual(['wall_base', 'wall_variant_01', 'wall_variant_02', 'wall_service_manifold']);
    expect(ORDINARY_SURFACE_POOLS[2].wall[0]).toEqual(['wall_base', 88]);
    expect(ORDINARY_SURFACE_POOLS[1].floor.map(([name]) => name)).not.toContain('floor_variant_04');
    expect(ORDINARY_SURFACE_POOLS[1].floor.map(([name]) => name)).toContain('floor_spalled_slab');
    expect(ORDINARY_SURFACE_POOLS[1].wall.map(([name]) => name)).toContain('wall_exposed_lath');
    expect(ORDINARY_SURFACE_POOLS[1].wall.map(([name]) => name)).toContain('wall_variant_01');
    expect(ORDINARY_SURFACE_POOLS[3].floor.filter(([name]) => name !== 'floor_base')).toHaveLength(3);
    expect(ORDINARY_SURFACE_POOLS[3].floor[0]).toEqual(['floor_base', 78]);
    expect(ORDINARY_SURFACE_POOLS[3].wall[0]).toEqual(['wall_base', 78]);

    for (let floor = 1; floor <= 4; floor++) {
      const pool = ORDINARY_SURFACE_POOLS[floor as 1 | 2 | 3 | 4];
      for (const walkable of [true, false]) {
        const allowed = new Set((walkable ? pool.floor : pool.wall).map(([name]) => name));
        for (let y = 0; y < 37; y++) for (let x = 0; x < 43; x++) {
          expect(allowed.has(ordinarySurfaceAssetAt(floor, x, y, walkable)!)).toBe(true);
          expect(ordinarySurfaceAssetAt(floor, x, y, walkable)).toBe(ordinarySurfaceAssetAt(floor, x, y, walkable));
        }
      }
    }

    const tiles = Array.from({ length: 37 }, () => Array.from({ length: 43 }, () => true));
    const protectedTiles = new Set(['0,0', '21,18', '42,36']);
    const first = ordinarySurfaceAssetsForMap(3, tiles, protectedTiles);
    expect(first).toEqual(ordinarySurfaceAssetsForMap(3, tiles, protectedTiles));
    for (const [x, y] of [[0, 0], [21, 18], [42, 36]]) expect(first[y][x]).toBe('floor_base');
    const selected = new Set(first.flat());
    expect(selected.has('floor_variant_01')).toBe(true);
    expect(selected.has('floor_variant_02')).toBe(true);
    expect(selected.has('floor_variant_03')).toBe(true);
    expect(selected.has('floor_variant_04')).toBe(false);
    for (let y = 0; y < 37; y++) for (let x = 0; x < 43; x++) {
      if (first[y][x] === 'floor_base') continue;
      for (const [nx, ny] of [[x - 1, y - 1], [x, y - 1], [x + 1, y - 1], [x - 1, y], [x + 1, y], [x - 1, y + 1], [x, y + 1], [x + 1, y + 1]] as const) {
        expect(first[ny]?.[nx] === first[y][x]).toBe(false);
      }
    }
    expect(ordinaryEnvironmentCoordinateHash(4, 21, 13)).toBe(ordinaryEnvironmentCoordinateHash(4, 21, 13));
  });

  it('keeps Block 3 wear sparse and deterministic while preserving its peeling identity', () => {
    const count = (walkable: boolean) => {
      const totals = { stain: 0, crack: 0, pipe: 0 };
      for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
        const dressing = tileDressingAt(3, x, y, walkable);
        if (dressing === 'stain' || dressing === 'crack' || dressing === 'pipe') totals[dressing]++;
      }
      return totals;
    };
    const floorWear = count(true);
    expect(floorWear.stain).toBeGreaterThan(750);
    expect(floorWear.stain).toBeLessThan(850);
    expect(floorWear.crack).toBeGreaterThan(150);
    expect(floorWear.crack).toBeLessThan(250);
    const wallWear = count(false);
    expect(wallWear.pipe).toBeGreaterThan(350);
    expect(wallWear.pipe).toBeLessThan(450);
    expect(wallWear.crack).toBeGreaterThan(1150);
    expect(wallWear.crack).toBeLessThan(1250);
    let peeling = 0;
    for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
      if (architecturalMarkAt(3, x, y, false) === 'peel') peeling++;
    }
    expect(peeling).toBeGreaterThan(400);
    expect(peeling).toBeLessThan(650);
  });

  it('keeps Block 2 surfaces mostly on shared base tiles with reduced wear and warning density', () => {
    const tiles = Array.from({ length: 100 }, () => Array.from({ length: 100 }, () => true));
    const surfaces = ordinarySurfaceAssetsForMap(2, tiles);
    const counts = surfaces.flat().reduce<Record<string, number>>((total, name) => {
      total[name] = (total[name] ?? 0) + 1;
      return total;
    }, {});
    expect(counts.floor_base).toBeGreaterThan(7600);
    expect(counts.floor_service_grate).toBeGreaterThan(0);
    expect(counts.floor_variant_03).toBeUndefined();
    const dressingCounts = { stain: 0, crack: 0, warning: 0 };
    for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
      const dressing = tileDressingAt(2, x, y, true);
      if (dressing === 'stain' || dressing === 'crack' || dressing === 'warning') dressingCounts[dressing]++;
    }
    expect(dressingCounts.stain).toBeGreaterThan(350);
    expect(dressingCounts.stain).toBeLessThan(450);
    expect(dressingCounts.crack).toBeGreaterThan(50);
    expect(dressingCounts.crack).toBeLessThan(150);
    expect(dressingCounts.warning).toBeGreaterThan(50);
    expect(dressingCounts.warning).toBeLessThan(150);
    let warningMarks = 0;
    for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
      if (architecturalMarkAt(2, x, y, true) === 'warning_repeat') warningMarks++;
    }
    expect(warningMarks).toBeGreaterThan(150);
    expect(warningMarks).toBeLessThan(275);
  });

  it('reuses requested shared base art or signals procedural tile fallback when base art is missing', () => {
    expect(resolveOrdinarySurfaceAsset('floor_variant_01', name => name === 'floor_variant_01')).toBe('floor_variant_01');
    expect(resolveOrdinarySurfaceAsset('floor_variant_02', name => name === 'floor_base')).toBe('floor_base');
    expect(resolveOrdinarySurfaceAsset('floor_variant_03', name => name === 'floor_variant_01')).toBe('floor_variant_01');
    expect(resolveOrdinarySurfaceAsset('floor_variant_04', name => name === 'floor_base')).toBe('floor_base');
    expect(resolveOrdinarySurfaceAsset('wall_variant_02', name => name === 'wall_variant_01')).toBe('wall_variant_01');
    expect(resolveOrdinarySurfaceAsset('wall_variant_01', () => false)).toBeNull();
  });

  it('uses only the existing matching block mark for each deterioration overlay', () => {
    const found = new Map<number, string>();
    for (let floor = 1; floor <= 4; floor++) {
      for (let y = 0; y < 37; y++) {
        for (let x = 0; x < 43; x++) {
          for (const walkable of [false, true]) {
            const overlay = ordinaryOverlayAssetAt(floor, x, y, walkable);
            expect(overlay).toBe(ordinaryOverlayAssetAt(floor, x, y, walkable));
            if (overlay) found.set(floor, overlay);
            if (floor === 4) expect(overlay).toBeNull();
            if (floor === 3 && overlay) {
              expect(walkable).toBe(false);
              expect(architecturalMarkAt(floor, x, y, walkable)).toBe('peel');
              expect(['wall_peel_01', 'wall_peel_02']).toContain(overlay);
            }
            if (floor === 2 && (overlay === 'hazard_floor_marking_01' || overlay === 'maintenance_marking_01')) {
              expect(architecturalMarkAt(floor, x, y, walkable)).toBe('warning_repeat');
              expect(['maintenance_marking_01', 'hazard_floor_marking_01']).toContain(overlay);
            }
            if (floor === 2 && (overlay === 'wall_pipe_leak' || overlay === 'wall_vent_cage')) {
              expect(walkable).toBe(false);
              expect(overlay).toBe(ordinaryOverlayAssetAt(floor, x, y, walkable));
            }
            if (floor === 1 && (overlay === 'floor_rubble_overlay' || overlay === 'wall_torn_notice')) {
              expect(walkable).toBe(overlay === 'floor_rubble_overlay');
            } else if (floor === 1 && overlay) {
              if (overlay === 'damaged_floor_panel_01') expect(walkable).toBe(true);
              else {
                expect(architecturalMarkAt(floor, x, y, walkable)).toBe('fracture');
                expect(['fracture_overlay_01', 'wall_spall_01']).toContain(overlay);
              }
            }
          }
        }
      }
    }
    expect(['wall_peel_01', 'wall_peel_02']).toContain(found.get(3));
    expect(['maintenance_marking_01', 'hazard_floor_marking_01', 'wall_pipe_leak', 'wall_vent_cage']).toContain(found.get(2));
    expect(['fracture_overlay_01', 'wall_spall_01', 'damaged_floor_panel_01', 'floor_rubble_overlay', 'wall_torn_notice']).toContain(found.get(1));
    expect(ordinaryOverlayAssetAt(0, 10, 10, false)).toBeNull();
  });

  it('selects the new Block 2 and Block 1 authored overlays sparsely and only on their intended surface types', () => {
    const found = new Set<string>();
    for (let y = 0; y < 120; y++) for (let x = 0; x < 120; x++) {
      const block2Wall = ordinaryOverlayAssetAt(2, x, y, false);
      if (block2Wall === 'wall_pipe_leak' || block2Wall === 'wall_vent_cage') found.add(block2Wall);
      const block1Floor = ordinaryOverlayAssetAt(1, x, y, true);
      const block1Wall = ordinaryOverlayAssetAt(1, x, y, false);
      if (block1Floor === 'floor_rubble_overlay') found.add(block1Floor);
      if (block1Wall === 'wall_torn_notice') found.add(block1Wall);
      expect(ordinaryOverlayAssetAt(3, x, y, false)).not.toBe('wall_pipe_leak');
      expect(ordinaryOverlayAssetAt(4, x, y, true)).toBeNull();
    }
    expect(found).toEqual(new Set(['wall_pipe_leak', 'wall_vent_cage', 'floor_rubble_overlay', 'wall_torn_notice']));
  });

  it('keeps identical Block 3 peel overlays from touching while protecting special coordinates', () => {
    const walls = Array.from({ length: 37 }, () => Array.from({ length: 43 }, () => false));
    const protectedTiles = new Set(['12,12', '20,20']);
    const first = ordinaryOverlayAssetsForMap(3, walls, protectedTiles);
    expect(first).toEqual(ordinaryOverlayAssetsForMap(3, walls, protectedTiles));
    expect(first[12][12]).toBeNull();
    expect(first[20][20]).toBeNull();
    expect(first.flat().some(asset => asset === 'wall_peel_01')).toBe(true);
    expect(first.flat().some(asset => asset === 'wall_peel_02')).toBe(true);
    for (let y = 0; y < 37; y++) for (let x = 0; x < 43; x++) {
      if (!first[y][x]) continue;
      for (const [nx, ny] of [[x - 1, y - 1], [x, y - 1], [x + 1, y - 1], [x - 1, y], [x + 1, y], [x - 1, y + 1], [x, y + 1], [x + 1, y + 1]] as const) {
        expect(first[ny]?.[nx]).not.toBe(first[y][x]);
      }
    }
    expect(ordinaryOverlayAssetsForMap(0, walls).flat().every(asset => asset === null)).toBe(true);
  });

  it('resolves Block 3 peel and Block 1 spall fallbacks without stacking overlays', () => {
    expect(resolveOrdinaryOverlayAsset('wall_peel_02', name => name === 'wall_peel_01')).toBe('wall_peel_01');
    expect(resolveOrdinaryOverlayAsset('wall_spall_01', name => name === 'fracture_overlay_01')).toBe('fracture_overlay_01');
    expect(resolveOrdinaryOverlayAsset('hazard_floor_marking_01', name => name === 'maintenance_marking_01')).toBe('maintenance_marking_01');
    const peelVariants = new Set<string>();
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
      const mark = ordinaryOverlayAssetAt(3, x, y, false);
      if (mark === 'wall_peel_01' || mark === 'wall_peel_02') peelVariants.add(mark);
    }
    expect(peelVariants).toEqual(new Set(['wall_peel_01', 'wall_peel_02']));
    expect(ordinaryOverlayAssetAt(1, 2, 1, false)).not.toBe('damaged_floor_panel_01');
  });

  it('places sparse deterministic wall fixtures and Block 4 wayfinding outside protected/door tiles', () => {
    const floor4 = generateFloor(0x4134, 4);
    const protectedTiles = new Set([
      `${floor4.start[0]},${floor4.start[1]}`,
      `${floor4.key[0]},${floor4.key[1]}`,
      `${floor4.exit[0]},${floor4.exit[1]}`,
      ...floor4.searchables.map(item => `${item.x},${item.y}`),
    ]);
    const plates = ordinaryMapDecorationPlacements(4, floor4.tiles, floor4.doors, protectedTiles);
    expect(plates).toEqual(ordinaryMapDecorationPlacements(4, floor4.tiles, floor4.doors, protectedTiles));
    const signs = plates.filter(item => item.asset === 'block4_wayfinding_plate_01');
    expect(signs.length).toBeLessThanOrEqual(3);
    expect(signs.length).toBeGreaterThan(0);
    expect(plates.length).toBeGreaterThan(12);
    expect(ordinaryMapDecorationPlacements(3, floor4.tiles, floor4.doors, protectedTiles).some(item => item.asset === 'block4_wayfinding_plate_01')).toBe(false);

    const doorAndNeighbors = new Set<string>();
    for (const [x, y] of floor4.doors) {
      doorAndNeighbors.add(`${x},${y}`);
      for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]) doorAndNeighbors.add(`${nx},${ny}`);
    }
    for (const placement of plates) {
      expect(protectedTiles.has(`${placement.x},${placement.y}`)).toBe(false);
      if (placement.asset !== 'block4_wayfinding_plate_01') expect(doorAndNeighbors.has(`${placement.x},${placement.y}`)).toBe(false);
    }
  });

  it('gives doorway paint a distinct but restrained progression across Blocks 4–1', () => {
    expect([4, 3, 2, 1].map(ordinaryThresholdTreatment)).toEqual([
      { style: 'orderly', color: 0xb9c5bc, alpha: 0.54 },
      { style: 'worn', color: 0xb08a68, alpha: 0.48 },
      { style: 'hazard', color: 0xd1a65d, alpha: 0.72 },
      { style: 'fracture', color: 0xa27494, alpha: 0.56 },
    ]);
    expect(ordinaryThresholdTreatment(0)).toBeNull();
  });

  it('scopes Block 2 panels and Block 1 floor/wall damage to their eligible tiles', () => {
    const floor2 = generateFloor(0x1202, 2);
    const floor2Protected = new Set([
      `${floor2.start[0]},${floor2.start[1]}`,
      `${floor2.key[0]},${floor2.key[1]}`,
      `${floor2.exit[0]},${floor2.exit[1]}`,
      ...floor2.searchables.map(item => `${item.x},${item.y}`),
    ]);
    const floor2Props = ordinaryMapDecorationPlacements(2, floor2.tiles, floor2.doors, floor2Protected);
    expect(floor2Props.every(item => item.asset !== 'breaker_panel_01' || !floor2.tiles[item.y][item.x])).toBe(true);
    expect(floor2Props.some(item => item.asset === 'breaker_panel_01')).toBe(true);
    expect(floor2Props.some(item => item.asset === 'breaker_panel_faulty')).toBe(true);
    expect(floor2Props.some(item => item.asset === 'cable_junction')).toBe(true);
    expect(floor2Props.some(item => item.asset === 'water_damaged_wall')).toBe(true);
    expect(floor2Props).toEqual(ordinaryMapDecorationPlacements(2, floor2.tiles, floor2.doors, floor2Protected));
    const floor2DoorTiles = new Set(floor2.doors.map(([x, y]) => `${x},${y}`));
    const floor2Hazard = floor2.tiles.flatMap((row, y) => row.map((walkable, x) => ordinaryOverlayAssetAt(2, x, y, walkable) === 'hazard_floor_marking_01' ? [x, y] as const : null)).filter((point): point is readonly [number, number] => point !== null);
    expect(floor2Hazard.length).toBeGreaterThan(0);
    for (const [x, y] of floor2Hazard) {
      expect(floor2.tiles[y][x]).toBe(true);
      if (floor2Protected.has(`${x},${y}`) || floor2DoorTiles.has(`${x},${y}`)) {
        expect(ordinaryOverlayPlacementAllowed('hazard_floor_marking_01', floor2Protected.has(`${x},${y}`), floor2DoorTiles.has(`${x},${y}`))).toBe(false);
      }
    }
    expect(ordinaryMapDecorationPlacements(1, floor2.tiles, floor2.doors, new Set()).some(item => item.asset === 'breaker_panel_01')).toBe(false);

    const floor1 = generateFloor(0x1010, 1);
    const protectedTiles = new Set([
      `${floor1.start[0]},${floor1.start[1]}`,
      `${floor1.key[0]},${floor1.key[1]}`,
      `${floor1.exit[0]},${floor1.exit[1]}`,
      ...floor1.searchables.map(item => `${item.x},${item.y}`),
      ...floor1.doors.map(([x, y]) => `${x},${y}`),
    ]);
    let damagedFloorCount = 0;
    for (let y = 0; y < floor1.height; y++) for (let x = 0; x < floor1.width; x++) {
      const asset = ordinaryOverlayAssetAt(1, x, y, floor1.tiles[y][x]);
      if (asset === 'damaged_floor_panel_01') {
        if (ordinaryOverlayPlacementAllowed(asset, protectedTiles.has(`${x},${y}`), floor1.doors.some(([dx, dy]) => dx === x && dy === y))) {
          damagedFloorCount++;
          expect(floor1.tiles[y][x]).toBe(true);
          expect(protectedTiles.has(`${x},${y}`)).toBe(false);
        }
      }
      if (asset === 'wall_spall_01' && ordinaryOverlayPlacementAllowed(asset, protectedTiles.has(`${x},${y}`), false)) expect(floor1.tiles[y][x]).toBe(false);
    }
    expect(damagedFloorCount).toBeGreaterThan(0);
    const floor1Props = ordinaryMapDecorationPlacements(1, floor1.tiles, floor1.doors, new Set([
      `${floor1.start[0]},${floor1.start[1]}`, `${floor1.key[0]},${floor1.key[1]}`, `${floor1.exit[0]},${floor1.exit[1]}`,
      ...floor1.searchables.map(item => `${item.x},${item.y}`),
    ]));
    expect(floor1Props).toEqual(ordinaryMapDecorationPlacements(1, floor1.tiles, floor1.doors, new Set([
      `${floor1.start[0]},${floor1.start[1]}`, `${floor1.key[0]},${floor1.key[1]}`, `${floor1.exit[0]},${floor1.exit[1]}`,
      ...floor1.searchables.map(item => `${item.x},${item.y}`),
    ])));
    expect(floor1Props.some(item => item.asset === 'abandoned_belongings')).toBe(true);
    expect(floor1Props.some(item => item.asset === 'failed_repair_patch')).toBe(true);
    expect(floor1Props.some(item => item.asset === 'departure_notice')).toBe(true);
    for (const item of floor1Props.filter(item => item.asset === 'abandoned_belongings')) expect(floor1.tiles[item.y][item.x]).toBe(true);
  });

  it('maps container types on Blocks 4–1 and reuses their shared art on Block 13', () => {
    expect(ordinaryContainerAssetAt(4, 'cabinet')).toBe('container_metal_closed');
    expect(ordinaryContainerAssetAt(3, 'locker')).toBe('container_supply_closed');
    expect(ordinaryContainerAssetAt(2, 'box')).toBe('container_wood_closed');
    expect(ordinaryContainerAssetAt(1, 'drawer', 12, 8)).toBe(ordinaryContainerAssetAt(1, 'drawer', 12, 8));
    expect(['container_wood_closed', 'container_metal_closed', 'container_supply_closed']).toContain(ordinaryContainerAssetAt(1, 'drawer', 12, 8));
    expect(ordinaryContainerAssetAt(1, 'drawer', 12, 8, true)).toBe(ordinaryContainerAssetAt(1, 'drawer', 12, 8)!.replace('_closed', '_open'));
    expect(ordinaryContainerAssetAt(0, 'maintenance_lockbox')).toBe('container_lockbox_closed');
    expect(ordinaryContainerAssetAt(0, 'maintenance_lockbox', 0, 0, true)).toBe('container_lockbox_open');
    expect(ordinaryContainerAssetAt(1, 'mimic')).toBeNull();
    expect(ordinaryContainerAssetAt(0, 'box')).toBe('container_wood_closed');
    expect(resolveOrdinaryContainerTexture(4, 'cabinet', name => name === 'container_metal_closed', 'searchable_cabinet')).toBe('env_container_metal_closed');
    expect(resolveOrdinaryContainerTexture(4, 'cabinet', () => false, 'searchable_cabinet')).toBe('searchable_cabinet');
    expect(resolveOrdinaryContainerTexture(1, 'mimic', () => true, 'mimic_4_8')).toBe('mimic_4_8');
    expect(resolveOrdinaryContainerTexture(0, 'box', () => true, 'searchable_box')).toBe('env_container_wood_closed');
    expect(resolveOrdinaryContainerTexture(0, 'box', () => false, 'searchable_box')).toBe('searchable_box');
  });

  it('uses searched state for authored open textures and retains Mimic hiding behavior', () => {
    const floorScene = readFileSync(new URL('../src/game/scenes/FloorScene.ts', import.meta.url), 'utf8');
    expect(floorScene).toContain('this.searchableTextureName(entry.data, entry.searched)');
    expect(floorScene).toContain('entry.data.isMimic ? !entry.searched : true');
    expect(floorScene).toContain('this.createOpenContainerFallbackTexture(entry.data)');
    expect(floorScene).toContain("'container_lockbox_open'");
  });

  it('keeps Block 13 surface and overlay selection on its separate existing path', () => {
    expect(block13SurfaceAssetAt(0, 9, 12, true)).not.toBeNull();
    expect(block13OverlayAssetAt(0, 9, 12, true)).toBe(block13OverlayAssetAt(0, 9, 12, true));
    expect(ordinarySurfaceAssetAt(0, 9, 12, true)).toBeNull();
    expect(ordinaryOverlayAssetAt(0, 9, 12, true)).toBeNull();
  });
});
