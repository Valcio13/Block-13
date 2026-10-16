export type AudioPreferenceCategory = 'master' | 'sfx' | 'ambience' | 'music';
export interface AudioPreferences {
  masterVolume: number;
  sfxVolume: number;
  ambienceVolume: number;
  musicVolume: number;
  masterMuted: boolean;
  sfxMuted: boolean;
  ambienceMuted: boolean;
  musicMuted: boolean;
  reduceJumpscareIntensity: boolean;
}

export const AUDIO_PREFERENCES_STORAGE_KEY = 'block13_audio_settings';
export const AUDIO_PREFERENCES_CHANGED_EVENT = 'block13:audio-preferences-changed';
export const AUDIO_PREFERENCES_DEFAULTS: Readonly<AudioPreferences> = Object.freeze({
  masterVolume: 0.9,
  sfxVolume: 0.9,
  ambienceVolume: 0.8,
  musicVolume: 0.75,
  masterMuted: false,
  sfxMuted: false,
  ambienceMuted: false,
  musicMuted: false,
  reduceJumpscareIntensity: false,
});

export function normalizeAudioPreferences(value: unknown): AudioPreferences {
  const candidate = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<AudioPreferences>
    : {};
  const normalized = { ...AUDIO_PREFERENCES_DEFAULTS };
  for (const key of ['masterVolume', 'sfxVolume', 'ambienceVolume', 'musicVolume'] as const) {
    const valueForKey = candidate[key];
    if (typeof valueForKey === 'number' && Number.isFinite(valueForKey) && valueForKey >= 0 && valueForKey <= 1) normalized[key] = valueForKey;
  }
  for (const key of ['masterMuted', 'sfxMuted', 'ambienceMuted', 'musicMuted', 'reduceJumpscareIntensity'] as const) {
    const valueForKey = candidate[key];
    if (typeof valueForKey === 'boolean') normalized[key] = valueForKey;
  }
  return normalized;
}

export function loadAudioPreferences(): AudioPreferences {
  try {
    const saved = globalThis.localStorage?.getItem(AUDIO_PREFERENCES_STORAGE_KEY);
    return saved ? normalizeAudioPreferences(JSON.parse(saved)) : { ...AUDIO_PREFERENCES_DEFAULTS };
  } catch {
    return { ...AUDIO_PREFERENCES_DEFAULTS };
  }
}

export function saveAudioPreferences(preferences: AudioPreferences): AudioPreferences {
  const normalized = normalizeAudioPreferences(preferences);
  try { globalThis.localStorage?.setItem(AUDIO_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized)); }
  catch { /* Storage can be unavailable in private browsing or test environments. */ }
  return normalized;
}

/** Persist and notify any active game mixer so sliders affect sounds already playing. */
export function publishAudioPreferences(preferences: AudioPreferences): AudioPreferences {
  const normalized = saveAudioPreferences(preferences);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUDIO_PREFERENCES_CHANGED_EVENT, { detail: normalized }));
  }
  return normalized;
}
