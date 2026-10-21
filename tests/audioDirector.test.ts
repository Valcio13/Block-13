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
import { PLAYER_FOOTSTEP_VARIANT_GAINS } from '../src/game/footstepMix';
import { AUDIO_ASSET_MANIFEST } from '../src/core/audioAssetManifest';

const mutableAudioManifest = AUDIO_ASSET_MANIFEST as Record<string, string>;

function directorFor(scene: Partial<Phaser.Scene>) {
  return new AudioDirector({ seed: 1, scene: scene as Phaser.Scene });
}

describe('AudioDirector optional playback', () => {
  it('uses audible new-user defaults and applies master, category, and mute changes to active sounds', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem });
    const sound = { isPlaying: true, play: vi.fn(), once: vi.fn(), stop: vi.fn(), setVolume: vi.fn() };
    const ambience = { isPlaying: true, play: vi.fn(), once: vi.fn(), stop: vi.fn(), setVolume: vi.fn() };
    const add = vi.fn((key: string) => key === 'amb_floor_2' ? ambience : sound);
    const director = directorFor({
      cache: { audio: { exists: () => true } } as unknown as Phaser.Cache.CacheManager,
      sound: { add } as unknown as Phaser.Sound.BaseSoundManager,
    });
    expect(director.getSettings()).toMatchObject({ masterVolume: 0.9, sfxVolume: 0.9, ambienceVolume: 0.8, musicVolume: 0.75 });
    expect(director.hasLoadedAsset('sfx_jumpscare_hit')).toBe(true);
    expect(director.hasLoadedAsset('sfx_ambusher_impact')).toBe(true);
    director.playWithCooldown('sfx_jumpscare_hit', 'sfx', 0, { volume: 0.95 });
    expect(add.mock.calls[0][1].volume).toBeCloseTo(0.9 * 0.9 * 0.95);
    director.play('amb_floor_2', 'ambience', { loop: true, volume: 0.45 });
    expect(add.mock.calls[1][1].volume).toBeCloseTo(0.9 * 0.8 * 0.45);
    director.setVolume('master', 0.5);
    expect(sound.setVolume).toHaveBeenLastCalledWith(0.5 * 0.9 * 0.95);
    director.setVolume('sfx', 0.3);
    expect(sound.setVolume).toHaveBeenLastCalledWith(0.5 * 0.3 * 0.95);
    expect(ambience.setVolume).toHaveBeenLastCalledWith(0.5 * 0.8 * 0.45);
    director.setMuted('sfx', true);
    expect(sound.setVolume).toHaveBeenLastCalledWith(0);
    expect(ambience.setVolume).toHaveBeenLastCalledWith(0.5 * 0.8 * 0.45);
    director.setMuted('sfx', false);
    expect(sound.setVolume).toHaveBeenLastCalledWith(0.5 * 0.3 * 0.95);
    expect(setItem).toHaveBeenCalled();
    director.shutdown();
    vi.unstubAllGlobals();
  });

  it('keeps the three footstep variants near a common perceived level with safe source headroom', () => {
    const observed = new Map<string, number>();
    for (let seed = 0; seed < 30; seed++) {
      const add = vi.fn(() => ({ isPlaying: true, play: vi.fn(), once: vi.fn(), stop: vi.fn() }));
      const director = new AudioDirector({
        seed,
        scene: {
          cache: { audio: { exists: () => true } },
          sound: { add },
        } as unknown as Phaser.Scene,
      });
      director.playVariantWithCooldown('sfx_player_footstep', 3, 'sfx', 0, undefined, PLAYER_FOOTSTEP_VARIANT_GAINS);
      const [key, config] = add.mock.calls[0];
      observed.set(key, config.volume);
      director.shutdown();
    }
    expect(observed.size).toBe(3);
    expect(observed.get('sfx_player_footstep_1')).toBeCloseTo(0.9 * 0.9 * PLAYER_FOOTSTEP_VARIANT_GAINS[0]);
    expect(observed.get('sfx_player_footstep_2')).toBeCloseTo(0.9 * 0.9 * PLAYER_FOOTSTEP_VARIANT_GAINS[1]);
    expect(observed.get('sfx_player_footstep_3')).toBeCloseTo(0.9 * 0.9 * PLAYER_FOOTSTEP_VARIANT_GAINS[2]);
  });

  it('keeps footsteps under both default and reduced Master/SFX slider settings', () => {
    const addDefault = vi.fn(() => ({ isPlaying: true, play: vi.fn(), once: vi.fn(), stop: vi.fn() }));
    const standard = new AudioDirector({ seed: 2, scene: { cache: { audio: { exists: () => true } }, sound: { add: addDefault } } as unknown as Phaser.Scene });
    standard.applyPreferences({ masterVolume: 0.9, sfxVolume: 0.9 });
    standard.playVariantWithCooldown('sfx_player_footstep', 3, 'sfx', 0, undefined, PLAYER_FOOTSTEP_VARIANT_GAINS);
    const standardVolume = addDefault.mock.calls[0][1].volume;
    standard.shutdown();

    const addReduced = vi.fn(() => ({ isPlaying: true, play: vi.fn(), once: vi.fn(), stop: vi.fn() }));
    const reduced = new AudioDirector({ seed: 2, scene: { cache: { audio: { exists: () => true } }, sound: { add: addReduced } } as unknown as Phaser.Scene });
    reduced.applyPreferences({ masterVolume: 0.5, sfxVolume: 0.45 });
    reduced.playVariantWithCooldown('sfx_player_footstep', 3, 'sfx', 0, undefined, PLAYER_FOOTSTEP_VARIANT_GAINS);
    expect(addReduced.mock.calls[0][1].volume).toBeCloseTo(standardVolume * (0.5 * 0.45) / (0.9 * 0.9));
    reduced.shutdown();
  });

  it('ducks only the requested category and restores its live mix without changing saved settings', () => {
    const sound = { isPlaying: true, play: vi.fn(), once: vi.fn(), stop: vi.fn(), setVolume: vi.fn() };
    const director = directorFor({
      cache: { audio: { exists: () => true } } as unknown as Phaser.Cache.CacheManager,
      sound: { add: () => sound } as unknown as Phaser.Sound.BaseSoundManager,
    });
    director.play('amb_floor_2', 'ambience', { loop: true, volume: 0.45 });
    director.setCategoryDucking('ambience', 0.25);
    expect(sound.setVolume).toHaveBeenLastCalledWith(0.9 * 0.8 * 0.45 * 0.25);
    expect(director.getSettings().ambienceVolume).toBe(0.8);
    director.setVolume('ambience', 0.6);
    expect(sound.setVolume).toHaveBeenLastCalledWith(0.9 * 0.6 * 0.45 * 0.25);
    director.setCategoryDucking('ambience', 1);
    expect(sound.setVolume).toHaveBeenLastCalledWith(0.9 * 0.6 * 0.45);
    director.shutdown();
  });

  it('replaces an active logical channel instead of stacking duplicate playback', () => {
    const first = { isPlaying: true, play: vi.fn(), once: vi.fn(), stop: vi.fn() };
    const second = { isPlaying: true, play: vi.fn(), once: vi.fn(), stop: vi.fn() };
    const add = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const director = directorFor({
      cache: { audio: { exists: () => true } } as unknown as Phaser.Cache.CacheManager,
      sound: { add } as unknown as Phaser.Sound.BaseSoundManager,
    });
    director.play('sfx_jumpscare_hit', 'sfx');
    director.play('sfx_jumpscare_hit', 'sfx');
    expect(first.stop).toHaveBeenCalledOnce();
    expect(add).toHaveBeenCalledTimes(2);
    director.shutdown();
  });

  it('ducks and restores ambience through the legacy major-scare API', () => {
    const ambience = { isPlaying: true, play: vi.fn(), once: vi.fn(), stop: vi.fn(), setVolume: vi.fn() };
    const director = directorFor({
      cache: { audio: { exists: () => true } } as unknown as Phaser.Cache.CacheManager,
      sound: { add: () => ambience } as unknown as Phaser.Sound.BaseSoundManager,
    });
    director.play('amb_floor_2', 'ambience', { loop: true, volume: 0.45 });
    director.setMajorScareAudioActive(true);
    expect(ambience.stop).not.toHaveBeenCalled();
    expect(ambience.setVolume).toHaveBeenLastCalledWith(0.9 * 0.8 * 0.45 * 0.22);
    director.setMajorScareAudioActive(false);
    expect(ambience.setVolume).toHaveBeenLastCalledWith(0.9 * 0.8 * 0.45);
    director.shutdown();
  });

  it('fades music in and keeps active music responsive to master/music settings and mute', () => {
    const music = { isPlaying: true, play: vi.fn(), once: vi.fn(), stop: vi.fn(), setVolume: vi.fn() };
    const tweenAdd = vi.fn((config: { targets: { value: number }; onUpdate: () => void; onComplete: () => void }) => {
      config.targets.value = 0.5;
      config.onUpdate();
      config.targets.value = 1;
      config.onUpdate();
      config.onComplete();
    });
    const director = directorFor({
      cache: { audio: { exists: () => true } } as unknown as Phaser.Cache.CacheManager,
      sound: { add: () => music } as unknown as Phaser.Sound.BaseSoundManager,
      tweens: { add: tweenAdd } as unknown as Phaser.Tweens.TweenManager,
    });
    director.play('music_block3_airy', 'music', { loop: true, volume: 0.24 });
    director.fadeInCategory('music', 900);
    expect(tweenAdd).toHaveBeenCalledOnce();
    expect(music.setVolume).toHaveBeenLastCalledWith(0.9 * 0.75 * 0.24);
    director.setVolume('master', 0.5);
    expect(music.setVolume).toHaveBeenLastCalledWith(0.5 * 0.75 * 0.24);
    director.setVolume('music', 0.4);
    expect(music.setVolume).toHaveBeenLastCalledWith(0.5 * 0.4 * 0.24);
    director.setMuted('music', true);
    expect(music.setVolume).toHaveBeenLastCalledWith(0);
    director.shutdown();
  });

  it('composes ambience fade-in with independent HauntingDirector ducking', () => {
    const ambience = { isPlaying: true, play: vi.fn(), once: vi.fn(), stop: vi.fn(), setVolume: vi.fn() };
    const tweenAdd = vi.fn((config: { targets: { value: number }; onUpdate: () => void; onComplete: () => void }) => {
      config.targets.value = 0.5;
      config.onUpdate();
      expect(ambience.setVolume).toHaveBeenLastCalledWith(0.9 * 0.8 * 0.45 * 0.25 * 0.5);
      config.targets.value = 1;
      config.onComplete();
    });
    const director = directorFor({
      cache: { audio: { exists: () => true } } as unknown as Phaser.Cache.CacheManager,
      sound: { add: () => ambience } as unknown as Phaser.Sound.BaseSoundManager,
      tweens: { add: tweenAdd } as unknown as Phaser.Tweens.TweenManager,
    });
    director.play('amb_floor_2', 'ambience', { loop: true, volume: 0.45 });
    director.setCategoryDucking('ambience', 0.25);
    director.fadeInCategory('ambience', 1000);
    expect(ambience.setVolume).toHaveBeenLastCalledWith(0.9 * 0.8 * 0.45 * 0.25);
    director.setCategoryDucking('ambience', 1);
    expect(ambience.setVolume).toHaveBeenLastCalledWith(0.9 * 0.8 * 0.45);
    director.shutdown();
  });

  it('preserves valid saved volume choices while ignoring malformed values', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify({ masterVolume: 0.2, sfxVolume: 1.5, ambienceVolume: 0.4, musicVolume: 0, sfxMuted: true }),
      setItem: vi.fn(),
    });
    const director = directorFor({});
    expect(director.getSettings()).toMatchObject({
      masterVolume: 0.2, sfxVolume: 0.9, ambienceVolume: 0.4, musicVolume: 0, sfxMuted: true,
    });
    director.shutdown();
    vi.unstubAllGlobals();
  });
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

  it('plays positional variants with attenuation and one shared event cooldown', () => {
    vi.useFakeTimers();
    mutableAudioManifest['enemy-cue_1'] = 'assets/audio/enemy-cue_1.ogg';
    mutableAudioManifest['enemy-cue_2'] = 'assets/audio/enemy-cue_2.ogg';
    const sound = { isPlaying: true, play: vi.fn(), once: vi.fn(), stop: vi.fn() };
    const add = vi.fn(() => sound);
    const director = directorFor({
      cache: { audio: { exists: () => true } } as unknown as Phaser.Cache.CacheManager,
      sound: { add } as unknown as Phaser.Sound.BaseSoundManager,
    });
    const config = { x: 30, y: 0, maxDistance: 100, category: 'sfx' as const, volume: 0.5 };
    expect(director.playPositionalVariantWithCooldown('enemy-cue', 2, config, 0, 0, 800)).toBe(sound);
    expect(add.mock.calls[0][1].volume).toBeCloseTo(0.9 * 0.9 * 0.5 * 0.7);
    expect(director.playPositionalVariantWithCooldown('enemy-cue', 2, config, 0, 0, 800)).toBeNull();
    expect(add).toHaveBeenCalledOnce();
    director.shutdown();
    delete mutableAudioManifest['enemy-cue_1'];
    delete mutableAudioManifest['enemy-cue_2'];
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

  it('fades an ambience category before stopping it', () => {
    const ambience = { isPlaying: true, volume: 0.3, play: vi.fn(), once: vi.fn(), stop: vi.fn() };
    const tweenAdd = vi.fn((config: { targets: unknown; volume: number; duration: number; onComplete: () => void }) => {
      expect(config.targets).toBe(ambience);
      expect(config.volume).toBe(0);
      expect(config.duration).toBe(700);
      config.onComplete();
    });
    mutableAudioManifest.amb_epilogue_test = 'assets/audio/amb_epilogue_test.ogg';
    const director = directorFor({
      cache: { audio: { exists: () => true } } as unknown as Phaser.Cache.CacheManager,
      sound: { add: () => ambience } as unknown as Phaser.Sound.BaseSoundManager,
      tweens: { add: tweenAdd } as unknown as Phaser.Tweens.TweenManager,
    });

    director.play('amb_epilogue_test', 'ambience', { loop: true, volume: 0.3 });
    director.fadeOutCategory('ambience', 700);

    expect(tweenAdd).toHaveBeenCalledOnce();
    expect(ambience.stop).toHaveBeenCalledOnce();
    director.shutdown();
    delete mutableAudioManifest.amb_epilogue_test;
  });

  it('pauses and resumes active presentation sounds without changing their gains', () => {
    const ambience = {
      isPlaying: true,
      play: vi.fn(),
      once: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      setVolume: vi.fn(),
    };
    mutableAudioManifest.amb_pause_test = 'assets/audio/amb_pause_test.ogg';
    const director = directorFor({
      cache: { audio: { exists: () => true } } as unknown as Phaser.Cache.CacheManager,
      sound: { add: () => ambience } as unknown as Phaser.Sound.BaseSoundManager,
    });
    director.play('amb_pause_test', 'ambience', { loop: true, volume: 0.3 });
    director.pausePresentation();
    expect(ambience.pause).toHaveBeenCalledOnce();
    director.resumePresentation();
    expect(ambience.resume).toHaveBeenCalledOnce();
    director.shutdown();
    delete mutableAudioManifest.amb_pause_test;
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
