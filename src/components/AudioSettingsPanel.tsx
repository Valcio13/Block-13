import { useEffect, useRef, useState } from 'react';
import { AUDIO_ASSET_MANIFEST } from '../core/audioAssetManifest';
import {
  AUDIO_PREFERENCES_DEFAULTS,
  loadAudioPreferences,
  publishAudioPreferences,
  type AudioPreferences,
} from '../core/audioPreferences';

interface AudioSettingsPanelProps { onClose: () => void; }
type VolumeKey = 'masterVolume' | 'sfxVolume' | 'ambienceVolume' | 'musicVolume';
type MuteKey = 'masterMuted' | 'sfxMuted' | 'ambienceMuted' | 'musicMuted';
type PreviewCategory = 'sfx' | 'ambience' | 'music';

const VOLUMES: ReadonlyArray<{ key: VolumeKey; mute: MuteKey; label: string }> = [
  { key: 'masterVolume', mute: 'masterMuted', label: 'Master Volume' },
  { key: 'sfxVolume', mute: 'sfxMuted', label: 'SFX Volume' },
  { key: 'ambienceVolume', mute: 'ambienceMuted', label: 'Ambience Volume' },
  { key: 'musicVolume', mute: 'musicMuted', label: 'Music Volume' },
];
const PREVIEWS: Record<PreviewCategory, { key: string; durationMs: number }> = {
  sfx: { key: 'sfx_player_footstep_1', durationMs: 1800 },
  ambience: { key: 'amb_floor_3', durationMs: 3500 },
  music: { key: 'music_block3_airy', durationMs: 3500 },
};

function effectivePreviewVolume(preferences: AudioPreferences, category: PreviewCategory) {
  const categoryVolume = category === 'sfx' ? preferences.sfxVolume
    : category === 'ambience' ? preferences.ambienceVolume : preferences.musicVolume;
  const muted = preferences.masterMuted || (category === 'sfx' ? preferences.sfxMuted
    : category === 'ambience' ? preferences.ambienceMuted : preferences.musicMuted);
  return muted ? 0 : preferences.masterVolume * categoryVolume;
}

export function AudioSettingsPanel({ onClose }: AudioSettingsPanelProps) {
  const [preferences, setPreferences] = useState<AudioPreferences>(loadAudioPreferences);
  const [previewStatus, setPreviewStatus] = useState('');
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const stopPreview = () => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = undefined;
    previewRef.current?.pause();
    if (previewRef.current) previewRef.current.currentTime = 0;
    previewRef.current = null;
  };

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      stopPreview();
      onCloseRef.current();
    };
    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keydown', trapTab, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keydown', trapTab, true);
      stopPreview();
      previousFocusRef.current?.focus();
    };
  }, []);

  const publish = (next: AudioPreferences) => {
    const normalized = publishAudioPreferences(next);
    setPreferences(normalized);
    if (previewRef.current) {
      const category = (previewRef.current.dataset.category ?? 'sfx') as PreviewCategory;
      previewRef.current.volume = effectivePreviewVolume(normalized, category);
      if (previewRef.current.volume === 0) stopPreview();
    }
  };

  const playPreview = async (category: PreviewCategory) => {
    stopPreview();
    const volume = effectivePreviewVolume(preferences, category);
    if (volume <= 0) {
      setPreviewStatus('Unmute this category to preview it.');
      return;
    }
    const preview = PREVIEWS[category];
    const audio = new Audio(AUDIO_ASSET_MANIFEST[preview.key]);
    audio.dataset.category = category;
    // Previews are bounded one-shots; ambience/music must not create a second
    // persistent loop beside the active game mix.
    audio.loop = false;
    audio.volume = Math.max(0, Math.min(1, volume));
    previewRef.current = audio;
    setPreviewStatus(`${category.toUpperCase()} preview`);
    try { await audio.play(); }
    catch { setPreviewStatus('Preview is unavailable in this browser.'); stopPreview(); return; }
    previewTimerRef.current = setTimeout(() => {
      stopPreview();
      setPreviewStatus('Preview finished.');
    }, preview.durationMs);
  };

  const reset = () => {
    stopPreview();
    publish({ ...AUDIO_PREFERENCES_DEFAULTS });
    setPreviewStatus('Audio settings reset.');
  };

  return (
    <div className="audio-settings-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={panelRef} className="audio-settings-panel" role="dialog" aria-modal="true" aria-labelledby="audio-settings-title">
        <header className="audio-settings-header">
          <div>
            <p className="audio-settings-eyebrow">SYSTEM // ACCESSIBILITY</p>
            <h2 id="audio-settings-title">AUDIO SETTINGS</h2>
          </div>
          <button ref={closeButtonRef} type="button" className="audio-settings-close" onClick={onClose} aria-label="Close audio settings">CLOSE ×</button>
        </header>
        <div className="audio-settings-controls">
          {VOLUMES.map(({ key, mute, label }) => (
            <div className="audio-setting-row" key={key}>
              <label htmlFor={key}>{label}<output htmlFor={key}>{Math.round(preferences[key] * 100)}%</output></label>
              <input id={key} type="range" min="0" max="100" step="1" value={Math.round(preferences[key] * 100)}
                aria-label={label} onChange={event => publish({ ...preferences, [key]: Number(event.currentTarget.value) / 100 })} />
              <label className="audio-mute-toggle"><input type="checkbox" checked={preferences[mute]} onChange={event => publish({ ...preferences, [mute]: event.currentTarget.checked })} /> Mute</label>
            </div>
          ))}
        </div>
        <div className="audio-preview-row" aria-label="Audio previews">
          <span>PREVIEW</span>
          {(['sfx', 'ambience', 'music'] as const).map(category => (
            <button type="button" key={category} onClick={() => void playPreview(category)}>{category.toUpperCase()}</button>
          ))}
        </div>
        <label className="reduced-scare-toggle">
          <input type="checkbox" checked={preferences.reduceJumpscareIntensity}
            onChange={event => publish({ ...preferences, reduceJumpscareIntensity: event.currentTarget.checked })} />
          <span><strong>Reduce Jumpscare Intensity</strong><small>Reduce abrupt flashes and camera or scale movement. Scares and gameplay remain unchanged.</small></span>
          <span className="audio-default">DEFAULT OFF</span>
        </label>
        <footer className="audio-settings-footer">
          <span role="status" aria-live="polite">{previewStatus || 'Changes save automatically.'}</span>
          <button type="button" onClick={reset}>RESET AUDIO DEFAULTS</button>
        </footer>
        <p className="audio-settings-hint">TAB / SHIFT+TAB NAVIGATE · ARROWS ADJUST · ESC CLOSE</p>
      </section>
    </div>
  );
}
