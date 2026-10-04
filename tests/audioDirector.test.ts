import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
    },
  },
}));

import { AudioDirector } from '../src/core/audioDirector';
import { AUDIO_ASSET_MANIFEST } from '../src/core/audioAssetManifest';

const mutableAudioManifest = AUDIO_ASSET_MANIFEST as Record<string, string>;

function directorFor(scene: Partial<Phaser.Scene>) {
  return new AudioDirector({ seed: 1, scene: scene as Phaser.Scene });
}

describe('AudioDirector optional playback', () => {
  it('skips missing assets without calling the sound manager', () => {
    const add = vi.fn();
    const director = directorFor({
      cache: { audio: { exists: () => false } } as unknown as Phaser.Cache.CacheManager,
      sound: { add } as unknown as Phaser.Sound.BaseSoundManager,
    });

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(director.play('missing-audio')).toBeNull();
    expect(add).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('catches an audio decode/play failure and returns control to gameplay', () => {
    mutableAudioManifest['broken-audio'] = 'assets/audio/broken-audio.ogg';
    const sound = {
      play: vi.fn(() => { throw new Error('decode failed'); }),
    };
    const director = directorFor({
      cache: { audio: { exists: () => true } } as unknown as Phaser.Cache.CacheManager,
      sound: { add: () => sound } as unknown as Phaser.Sound.BaseSoundManager,
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(director.play('broken-audio')).toBeNull();
    expect(sound.play).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();

    warn.mockRestore();
    delete mutableAudioManifest['broken-audio'];
  });
});
