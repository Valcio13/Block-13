import { describe, expect, it } from 'vitest';
import {
  BLOCK3_REFINED_EXPERIMENT_ASSETS,
  block3ExperimentTextureForAsset,
  block3RoomNoticeTile,
  block3SurfaceTextureAt,
  block3VisualModeLabel,
  nextBlock3VisualMode,
} from '../src/game/block3VisualExperiment';

describe('Block 3 development visual experiment', () => {
  it('registers only the isolated refined-candidate textures at their native sizes', () => {
    expect(BLOCK3_REFINED_EXPERIMENT_ASSETS).toHaveLength(15);
    expect(BLOCK3_REFINED_EXPERIMENT_ASSETS.map(asset => asset.file)).toEqual([
      'floor_primary.png', 'floor_secondary.png', 'floor_damaged.png', 'floor_light_wear.png',
      'floor_moderate_wear.png', 'wall_primary.png', 'wall_damaged.png', 'wall_stained.png',
      'wall_patch.png', 'room_notice.png', 'wall_floor_transition.png', 'door_threshold.png',
      'environmental_detail_01.png', 'environmental_detail_02.png', 'decorative_prop.png',
    ]);
    expect(BLOCK3_REFINED_EXPERIMENT_ASSETS.filter(asset => asset.width !== 32)).toEqual([]);
    expect(BLOCK3_REFINED_EXPERIMENT_ASSETS.filter(asset => asset.height !== 32)).toEqual([
      { key: 'dev_b3_decorative_prop', file: 'decorative_prop.png', width: 32, height: 48 },
    ]);
  });

  it('maps only ordinary Block 3 layer assets to refined equivalents', () => {
    expect(block3ExperimentTextureForAsset('floor_base')).toBe('dev_b3_floor_primary');
    expect(block3ExperimentTextureForAsset('floor_variant_03')).toBe('dev_b3_floor_damaged');
    expect(block3ExperimentTextureForAsset('wall_variant_01')).toBe('dev_b3_wall_damaged');
    expect(block3ExperimentTextureForAsset('wall_edge')).toBe('dev_b3_wall_floor_transition');
    expect(block3ExperimentTextureForAsset('threshold')).toBe('dev_b3_door_threshold');
    expect(block3ExperimentTextureForAsset('wall_lamp_01')).toBe('dev_b3_detail_01');
    expect(block3ExperimentTextureForAsset('hub_medallion')).toBeNull();
  });

  it('toggles labels without involving simulation state or randomness', () => {
    expect(nextBlock3VisualMode('original')).toBe('refined');
    expect(nextBlock3VisualMode('refined')).toBe('original');
    expect(block3VisualModeLabel('original')).toBe('ORIGINAL');
    expect(block3VisualModeLabel('refined')).toBe('REFINED');
  });

  it('selects stable, weighted wear grades and protects interaction tiles', () => {
    const tally = new Map<string, number>();
    for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) {
      const key = block3SurfaceTextureAt(x, y, true, true);
      tally.set(key, (tally.get(key) ?? 0) + 1);
      expect(block3SurfaceTextureAt(x, y, true, true)).toBe(key);
    }
    expect(tally.get('dev_b3_floor_primary')).toBeGreaterThan(tally.get('dev_b3_floor_light_wear')!);
    expect(tally.get('dev_b3_floor_light_wear')).toBeGreaterThan(tally.get('dev_b3_floor_moderate_wear')!);
    expect(tally.get('dev_b3_floor_moderate_wear')).toBeGreaterThan(tally.get('dev_b3_floor_damaged')!);
    expect(block3SurfaceTextureAt(5, 5, true, true, true)).toBe('dev_b3_floor_primary');
    expect(block3SurfaceTextureAt(5, 5, false, false, true)).toBe('dev_b3_wall_primary');
  });

  it('places one stable room notice on a safe wall beside a door', () => {
    const tiles = [
      [false, false, false],
      [false, true, false],
      [false, false, false],
    ];
    const doors = [[1, 1]] as const;
    const protectedTiles = new Set(['1,0']);
    const first = block3RoomNoticeTile(tiles, doors, protectedTiles);
    expect(first).not.toBeNull();
    expect(first).not.toEqual([1, 0]);
    expect(tiles[first![1]][first![0]]).toBe(false);
    expect(block3RoomNoticeTile(tiles, doors, protectedTiles)).toEqual(first);
  });
});
