import { describe, expect, it } from 'vitest';
import { assetPathForBase } from '../src/core/assetPath';

describe('production public asset URLs', () => {
  it('resolves all manifest paths from the origin root and a nested base consistently', () => {
    expect(assetPathForBase('/', '/sprites/characters/player/player_idle_down.png'))
      .toBe('/assets/sprites/characters/player/player_idle_down.png');
    expect(assetPathForBase('/contest/block13/', 'audio/music/music_block13_echoes.ogg'))
      .toBe('/contest/block13/assets/audio/music/music_block13_echoes.ogg');
    expect(assetPathForBase('/contest/block13', 'assets/sprites/environment/blocks/block_13/floor_base.png'))
      .toBe('/contest/block13/assets/sprites/environment/blocks/block_13/floor_base.png');
  });
});
