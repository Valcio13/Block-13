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
    expect(director.playWithCooldown('missing-audio', 'sfx', 1000)).toBeNull();
    expect(add).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('applies per-event cooldowns to prevent repeated playback spam', () => {
    vi.useFakeTimers();
    mutableAudioManifest['cooldown-audio'] = 'assets/audio/cooldown-audio.ogg';
    const sound = {
      isPlaying: true,
      play: vi.fn(),
      once: vi.fn(),
      stop: vi.fn(),
    };
    const add = vi.fn(() => sound);
    const director = directorFor({
      cache: { audio: { exists: () => true } } as unknown as Phaser.Cache.CacheManager,
      sound: { add } as unknown as Phaser.Sound.BaseSoundManager,
    });
    expect(director.playWithCooldown('cooldown-audio', 'sfx', 1000)).toBe(sound);
    expect(director.playWithCooldown('cooldown-audio', 'sfx', 1000)).toBeNull();
    vi.advanceTimersByTime(1001);
    expect(director.playWithCooldown('cooldown-audio', 'sfx', 1000)).toBe(sound);
    expect(add).toHaveBeenCalledTimes(2);
    director.shutdown();
    delete mutableAudioManifest['cooldown-audio'];
    vi.useRealTimers();
  });

  it('shares one cooldown across all selected variants of an event', () => {
    vi.useFakeTimers();
    mutableAudioManifest['hurt-event_1'] = 'assets/audio/hurt-event_1.ogg';
    mutableAudioManifest['hurt-event_2'] = 'assets/audio/hurt-event_2.ogg';
    const sound = { isPlaying: true, play: vi.fn(), once: vi.fn(), stop: vi.fn() };
    const add = vi.fn(() => sound);
    const director = directorFor({
      cache: { audio: { exists: () => true } } as unknown as Phaser.Cache.CacheManager,
      sound: { add } as unknown as Phaser.Sound.BaseSoundManager,
    });
    expect(director.playVariantWithCooldown('hurt-event', 2, 'sfx', 1000)).toBe(sound);
    expect(director.playVariantWithCooldown('hurt-event', 2, 'sfx', 1000)).toBeNull();
    expect(add).toHaveBeenCalledOnce();
    director.shutdown();
    delete mutableAudioManifest['hurt-event_1'];
    delete mutableAudioManifest['hurt-event_2'];
    vi.useRealTimers();
  });

  it('stops only ambience loops at a terminal screen and removes their handles', () => {
    const ambience = { isPlaying: true, play: vi.fn(), once: vi.fn(), stop: vi.fn() };
    const stinger = { isPlaying: true, play: vi.fn(), once: vi.fn(), stop: vi.fn() };
    mutableAudioManifest.amb_terminal_test = 'assets/audio/amb_terminal_test.ogg';
    mutableAudioManifest.sfx_terminal_test = 'assets/audio/sfx_terminal_test.ogg';
    const director = directorFor({
      cache: { audio: { exists: () => true } } as unknown as Phaser.Cache.CacheManager,
      sound: { add: (key: string) => key.startsWith('amb_') ? ambience : stinger } as unknown as Phaser.Sound.BaseSoundManager,
    });
    director.play('amb_terminal_test', 'ambience', { loop: true });
    director.play('sfx_terminal_test', 'sfx');

    director.stopCategory('ambience');

    expect(ambience.stop).toHaveBeenCalledOnce();
    expect(stinger.stop).not.toHaveBeenCalled();
    director.shutdown();
    delete mutableAudioManifest.amb_terminal_test;
    delete mutableAudioManifest.sfx_terminal_test;
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
