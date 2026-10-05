import type { SimulationEvent, AuthoritativeState } from './authoritativeSimulation';
import { isBlock13Floor } from './progression';

export type AudioCue = {
  key: string;
  cooldownMs: number;
  positional?: { x: number; y: number };
};

const cue = (key: string, cooldownMs = 0, positional?: { x: number; y: number }): AudioCue => ({ key, cooldownMs, positional });

/** Pure presentation mapping; it reads simulation output but never changes it. */
export function audioCuesForEvents(events: readonly SimulationEvent[]): AudioCue[] {
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
      case 'mimic_revealed':
        cues.push(cue('sfx_mimic_reveal', 1000));
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
  if (!previous.stalker.visible && current.stalker.visible) cues.push(cue('sfx_stalker_presence', 5000, { x: current.stalker.x, y: current.stalker.y }));
  if (previous.stalker.state !== 'hunting' && current.stalker.state === 'hunting') {
    cues.push(cue('sfx_danger_stinger', 5000));
    cues.push(cue(isBlock13Floor(current.floor) ? 'sfx_final_chase_stinger' : 'sfx_stalker_hunt', 5000, { x: current.stalker.x, y: current.stalker.y }));
    specificScare = true;
  }

  current.crawlers.forEach((enemy, index) => {
    const old = previous.crawlers.find(candidate => candidate.id === enemy.id) ?? previous.crawlers[index];
    if (old && !old.chasing && enemy.chasing) cues.push(cue('sfx_crawler_skitter', 900, { x: enemy.x, y: enemy.y }));
  });
  current.watchers.forEach((enemy, index) => {
    const old = previous.watchers.find(candidate => candidate.id === enemy.id) ?? previous.watchers[index];
    if (!old) return;
    if (old.active && !enemy.active) cues.push(cue('sfx_watcher_vanish', 1200, { x: old.x, y: old.y }));
    else if (!old.active && enemy.active) cues.push(cue('sfx_watcher_presence', 3000, { x: enemy.x, y: enemy.y }));
  });
  current.ambushers.forEach((enemy, index) => {
    const old = previous.ambushers.find(candidate => candidate.id === enemy.id) ?? previous.ambushers[index];
    if (!old) return;
    if (old.state !== 'warning' && enemy.state === 'warning') cues.push(cue('sfx_ambusher_warning', 2500, { x: enemy.x, y: enemy.y }));
    if (old.state !== 'jumpscare' && enemy.state === 'jumpscare') {
      cues.push(cue('sfx_ambusher_attack', 1200));
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
