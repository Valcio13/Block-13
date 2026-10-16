import { describe, expect, it, vi } from 'vitest';
import {
  AUDIO_PREFERENCES_DEFAULTS,
  AUDIO_PREFERENCES_STORAGE_KEY,
  loadAudioPreferences,
  normalizeAudioPreferences,
  saveAudioPreferences,
} from '../src/core/audioPreferences';

describe('audio preferences', () => {
  it('uses the established defaults and ignores malformed saved values', () => {
    expect(normalizeAudioPreferences({ masterVolume: 2, musicVolume: -1, sfxMuted: 'yes' })).toEqual(AUDIO_PREFERENCES_DEFAULTS);
    vi.stubGlobal('localStorage', { getItem: () => '{broken json' });
    expect(loadAudioPreferences()).toEqual(AUDIO_PREFERENCES_DEFAULTS);
    vi.unstubAllGlobals();
  });

  it('persists normalized settings including the accessibility choice', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    const result = saveAudioPreferences({ ...AUDIO_PREFERENCES_DEFAULTS, masterVolume: 0.4, musicMuted: true, reduceJumpscareIntensity: true });
    expect(result).toMatchObject({ masterVolume: 0.4, musicMuted: true, reduceJumpscareIntensity: true });
    expect(setItem).toHaveBeenCalledWith(AUDIO_PREFERENCES_STORAGE_KEY, JSON.stringify(result));
    vi.unstubAllGlobals();
  });
});
