import type { SimulationEvent, AuthoritativeState } from './authoritativeSimulation';
import type { AudioDirector } from './audioDirector';
import { isBlock13Floor } from './progression';

export type AudioCue = {
  key: string;
  cooldownMs: number;
  positional?: { x: number; y: number };
  volume?: number;
};

const cue = (key: string, cooldownMs = 0, positional?: { x: number; y: number }, volume?: number): AudioCue => ({ key, cooldownMs, positional, volume });

/** Dedicated impact gains through AudioDirector, preserving master and SFX settings. */
export const AMBUSHER_IMPACT_PRODUCTION_VOLUME = 0.48;
export const AMBUSHER_IMPACT_FALLBACK_VOLUME = 0.82;
export const AMBUSHER_PRE_IMPACT_AMBIENCE_GAIN = 0.25;
export function playAmbusherImpact(director: Pick<AudioDirector, 'hasLoadedAsset' | 'playWithCooldown' | 'stop'>, reduceIntensity = false): string | undefined {
  // A new encounter replaces any lingering tail instead of stacking it.
  director.stop('sfx_ambusher_impact');
  director.stop('sfx_jumpscare_hit');
  if (director.hasLoadedAsset('sfx_ambusher_impact')
    && director.playWithCooldown('sfx_ambusher_impact', 'sfx', 0, { volume: AMBUSHER_IMPACT_PRODUCTION_VOLUME * (reduceIntensity ? 0.56 : 1) })) return 'sfx_ambusher_impact';
  if (director.playWithCooldown('sfx_jumpscare_hit', 'sfx', 0, { volume: AMBUSHER_IMPACT_FALLBACK_VOLUME * (reduceIntensity ? 0.56 : 1) })) return 'sfx_jumpscare_hit';
  return undefined;
}

/** Pure presentation mapping; it reads simulation output but never changes it. */
export function audioCuesForEvents(events: readonly SimulationEvent[], state?: Pick<AuthoritativeState, 'mimics'>): AudioCue[] {
  const cues: AudioCue[] = [];
  for (const event of events) {
    switch (event.type) {
      case 'key_collected':
        cues.push(cue('sfx_key_pickup', 1000));
        break;
      case 'damage':
        cues.push(cue('sfx_player_hurt', 180));
        break;
      case 'loot_searched':
        cues.push(cue('sfx_interaction_search', 150));
        if (event.result.type === 'health') cues.push(cue('sfx_item_heal', 250));
        else if (event.result.type !== 'nothing' && event.result.type !== 'clue') cues.push(cue('sfx_item_pickup', 150));
        break;
      case 'floor_transition':
        cues.push(cue('sfx_floor_transition', 1500));
        break;
      case 'puzzle_solved':
        cues.push(cue('sfx_puzzle_solved', 1200));
        break;
      case 'mimic_revealed':
        {
          const mimic = state?.mimics[event.index];
          cues.push(cue('sfx_mimic_reveal', 1000, mimic ? { x: mimic.x, y: mimic.y } : undefined, 0.42));
        }
        break;
    }
  }
  return cues;
}

/** Map authoritative snapshot edges into one-shot presentation cues. */
export function audioCuesForStateChange(previous: AuthoritativeState, current: AuthoritativeState, events: readonly SimulationEvent[] = []): AudioCue[] {
  const cues: AudioCue[] = [];
  let specificScare = false;
  if (events.some(event => event.type === 'mimic_revealed')) specificScare = true;

  if (previous.flashlightOn !== current.flashlightOn) cues.push(cue(current.flashlightOn ? 'sfx_flashlight_on' : 'sfx_flashlight_off', 100));
  if (previous.battery > 20 * 256 && current.battery <= 20 * 256) cues.push(cue('sfx_battery_warning', 10_000));
  if (previous.corruption.effectId !== current.corruption.effectId) cues.push(cue('sfx_corruption_pulse', 1200));
  // Only the hunt recording is currently shipped. Use it quietly at the first
  // real visibility edge so the player hears the figure before identifying it.
  if (!previous.stalker.visible && current.stalker.visible && current.stalker.state !== 'hunting') cues.push(cue('sfx_stalker_presence', 5000, { x: current.stalker.x, y: current.stalker.y }, 0.34));
  if (previous.stalker.state !== 'hunting' && current.stalker.state === 'hunting') {
    if (!isBlock13Floor(current.floor)) cues.push(cue('sfx_danger_stinger', 5000));
    // Block 13 currently has no dedicated stinger asset; use its real, loaded
    // Stalker cue rather than queueing an unavailable catalog key.
    cues.push(cue('sfx_stalker_hunt', 5000, { x: current.stalker.x, y: current.stalker.y }, 0.55));
    specificScare = true;
  }

  current.crawlers.forEach((enemy, index) => {
    const old = previous.crawlers.find(candidate => candidate.id === enemy.id) ?? previous.crawlers[index];
    if (old && !old.chasing && enemy.chasing) cues.push(cue('sfx_crawler_skitter', 900, { x: enemy.x, y: enemy.y }, 0.5));
  });
  current.watchers.forEach((enemy, index) => {
    const old = previous.watchers.find(candidate => candidate.id === enemy.id) ?? previous.watchers[index];
    if (!old) return;
    if (old.active && !enemy.active) cues.push(cue('sfx_watcher_vanish', 1200, { x: old.x, y: old.y }, 0.35));
    else if (!old.active && enemy.active) cues.push(cue('sfx_watcher_presence', 3000, { x: enemy.x, y: enemy.y }, 0.32));
  });
  current.ambushers.forEach((enemy, index) => {
    const old = previous.ambushers.find(candidate => candidate.id === enemy.id) ?? previous.ambushers[index];
    if (!old) return;
    if (old.state !== 'warning' && enemy.state === 'warning') cues.push(cue('sfx_ambusher_warning', 2500, { x: enemy.x, y: enemy.y }, 0.28));
    if (old.state !== 'jumpscare' && enemy.state === 'jumpscare') {
      // FloorScene starts the hit with the first visible impact frame, after
      // the presentation-only micro-gap. Suppress the generic scare cue here.
      specificScare = true;
    }
  });
  if (previous.scareEventId !== current.scareEventId && !specificScare) cues.push(cue('sfx_jumpscare_hit', 1500));
  if (previous.status === 'playing' && current.status === 'lost') cues.push(cue('sfx_player_death', 2000));
  if (previous.status === 'playing' && current.status === 'won') cues.push(cue('sfx_escape', 3000));
  return cues;
}

export function floorAmbienceKeys(floor: number): string[] {
  const specific = isBlock13Floor(floor) ? 'amb_block13' : floor >= 1 && floor <= 4 ? `amb_floor_${floor}` : undefined;
  return specific ? [specific] : [];
}

export interface FloorMusicTrack {
  key: 'music_scary_halloween';
  /** Per-track trim before master and music settings are applied. */
  gain: number;
}

/** One restrained music bed is used across every playable floor. */
export function floorMusicTrack(floor: number): FloorMusicTrack | undefined {
  return floor >= 0 && floor <= 4 ? { key: 'music_scary_halloween', gain: 0.22 } : undefined;
}

export const FLOOR_MUSIC_PREVIEW: readonly FloorMusicTrack[] = [
  { key: 'music_scary_halloween', gain: 0.22 },
];
