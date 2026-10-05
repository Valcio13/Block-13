/**
 * AudioDirector - Centralized audio management for Block 13
 * 
 * Handles:
 * - Category-based volume control (master, sfx, ambience, music)
 * - Positional audio with distance attenuation
 * - Audio event triggering with cooldowns
 * - Graceful handling of missing assets
 * - Horror-specific audio rules (silence preservation, priority)
 */

import Phaser from 'phaser';
import { AUDIO_ASSET_MANIFEST } from './audioAssetManifest';
import { SeededRng } from './rng';

export type AudioCategory = 'master' | 'sfx' | 'ambience' | 'music';

export interface AudioConfig {
  seed: number;
  scene: Phaser.Scene;
}

export interface AudioSettings {
  masterVolume: number; // 0-1
  sfxVolume: number; // 0-1
  ambienceVolume: number; // 0-1
  musicVolume: number; // 0-1
  masterMuted: boolean;
  sfxMuted: boolean;
  ambienceMuted: boolean;
  musicMuted: boolean;
}

interface PositionalAudioConfig {
  key: string;
  x: number;
  y: number;
  maxDistance: number; // Distance at which sound becomes inaudible
  category: AudioCategory;
  volume?: number;
  loop?: boolean;
}

interface AudioCooldown {
  lastPlayed: number;
  cooldown: number; // ms
}

export class AudioDirector {
  private scene: Phaser.Scene;
  private rng: SeededRng;
  
  // Volume settings
  private settings: AudioSettings = {
    masterVolume: 0.7,
    sfxVolume: 0.8,
    ambienceVolume: 0.6,
    musicVolume: 0.5,
    masterMuted: false,
    sfxMuted: false,
    ambienceMuted: false,
    musicMuted: false,
  };
  
  // Active sounds tracking
  private activeSounds: Map<string, Phaser.Sound.BaseSound> = new Map();
  private static warnedUnavailableAudio = new Set<string>();
  
  // Cooldown tracking for audio events
  private cooldowns: Map<string, AudioCooldown> = new Map();
  
  // Major scare audio priority flag
  private majorScareAudioActive: boolean = false;
  
  constructor(config: AudioConfig) {
    this.scene = config.scene;
    this.rng = new SeededRng(config.seed ^ 0xA0D10);
    
    // Load settings from localStorage if available
    this.loadSettings();
  }
  
  // ====== SETTINGS ======
  
  private loadSettings() {
    try {
      const saved = localStorage.getItem('block13_audio_settings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (e) {
      // Ignore, use defaults
    }
  }
  
  public saveSettings() {
    try {
      localStorage.setItem('block13_audio_settings', JSON.stringify(this.settings));
    } catch (e) {
      // Ignore
    }
  }
  
  public setVolume(category: AudioCategory, volume: number) {
    volume = Phaser.Math.Clamp(volume, 0, 1);
    
    switch (category) {
      case 'master':
        this.settings.masterVolume = volume;
        break;
      case 'sfx':
        this.settings.sfxVolume = volume;
        break;
      case 'ambience':
        this.settings.ambienceVolume = volume;
        break;
      case 'music':
        this.settings.musicVolume = volume;
        break;
    }
    
    this.saveSettings();
    this.updateAllVolumes();
  }
  
  public setMuted(category: AudioCategory, muted: boolean) {
    switch (category) {
      case 'master':
        this.settings.masterMuted = muted;
        break;
      case 'sfx':
        this.settings.sfxMuted = muted;
        break;
      case 'ambience':
        this.settings.ambienceMuted = muted;
        break;
      case 'music':
        this.settings.musicMuted = muted;
        break;
    }
    
    this.saveSettings();
    this.updateAllVolumes();
  }
  
  public getSettings(): AudioSettings {
    return { ...this.settings };
  }
  
  private calculateVolume(category: AudioCategory, baseVolume: number = 1.0): number {
    if (this.settings.masterMuted) return 0;
    
    let categoryVolume = 1.0;
    let categoryMuted = false;
    
    switch (category) {
      case 'sfx':
        categoryVolume = this.settings.sfxVolume;
        categoryMuted = this.settings.sfxMuted;
        break;
      case 'ambience':
        categoryVolume = this.settings.ambienceVolume;
        categoryMuted = this.settings.ambienceMuted;
        break;
      case 'music':
        categoryVolume = this.settings.musicVolume;
        categoryMuted = this.settings.musicMuted;
        break;
    }
    
    if (categoryMuted) return 0;
    
    return this.settings.masterVolume * categoryVolume * baseVolume;
  }
  
  private updateAllVolumes() {
    // Update all active sounds
    this.activeSounds.forEach((sound, key) => {
      if (sound.isPlaying) {
        const category = this.getSoundCategory(key);
        const newVolume = this.calculateVolume(category);
        // Volume is read-only on BaseSound, but we can set it via config
        // For now, just track for future sounds
        // (Active sounds will play at their original volume)
      }
    });
  }
  
  private getSoundCategory(key: string): AudioCategory {
    if (key.startsWith('music_')) return 'music';
    if (key.startsWith('amb_')) return 'ambience';
    return 'sfx';
  }
  
  // ====== CORE PLAYBACK ======
  
  public play(
    key: string,
    category: AudioCategory = 'sfx',
    config?: Phaser.Types.Sound.SoundConfig
  ): Phaser.Sound.BaseSound | null {
    // Check if asset exists
    if (!this.isAudioAvailable(key)) {
      return null;
    }
    
    // Check cooldown
    if (this.isOnCooldown(key)) {
      return null;
    }
    
    // Check if major scare is active (blocks ambient/sfx except scares)
    if (this.majorScareAudioActive && category !== 'music' && !key.includes('scare')) {
      return null;
    }
    
    const volume = this.calculateVolume(category, config?.volume);
    
    let sound: Phaser.Sound.BaseSound;
    try {
      sound = this.scene.sound.add(key, { ...config, volume });
      sound.play();
    } catch (error) {
      this.warnUnavailableAudio(key, error);
      return null;
    }
    
    // Track active sound
    this.activeSounds.set(key, sound);
    
    sound.once('complete', () => {
      this.activeSounds.delete(key);
    });
    
    return sound;
  }
  
  public playPositional(config: PositionalAudioConfig, playerX: number, playerY: number): Phaser.Sound.BaseSound | null {
    // Check if asset exists
    if (!this.isAudioAvailable(config.key)) {
      return null;
    }
    
    // Check cooldown
    if (this.isOnCooldown(config.key)) {
      return null;
    }
    
    // Calculate distance
    const dx = config.x - playerX;
    const dy = config.y - playerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Check if out of range
    if (distance > config.maxDistance) {
      return null;
    }
    
    // Calculate volume based on distance (linear falloff)
    const distanceVolume = 1 - (distance / config.maxDistance);
    const baseVolume = (config.volume !== undefined) ? config.volume : 1.0;
    const volume = this.calculateVolume(config.category, baseVolume * distanceVolume);
    
    // Calculate pan (-1 left, 0 center, 1 right)
    // Pan based on relative X position, clamped to reasonable values
    const panRange = 400; // Distance from player at which pan reaches max
    const pan = Phaser.Math.Clamp(dx / panRange, -1, 1);
    
    let sound: Phaser.Sound.BaseSound;
    try {
      sound = this.scene.sound.add(config.key, {
        volume,
        loop: config.loop || false,
      });

      // Apply pan if supported (HTML5 Audio supports this)
      if ('pan' in sound && typeof (sound as any).pan !== 'undefined') {
        (sound as any).pan = pan;
      }

      sound.play();
    } catch (error) {
      this.warnUnavailableAudio(config.key, error);
      return null;
    }
    
    // Track active sound
    const trackingKey = `${config.key}_${config.x}_${config.y}`;
    this.activeSounds.set(trackingKey, sound);
    
    sound.once('complete', () => {
      this.activeSounds.delete(trackingKey);
    });
    
    return sound;
  }

  /** Play an optional one-shot at most once during the requested wall-clock cooldown. */
  public playWithCooldown(
    key: string,
    category: AudioCategory,
    cooldownMs: number,
    config?: Phaser.Types.Sound.SoundConfig,
  ): Phaser.Sound.BaseSound | null {
    if (this.isOnCooldown(key)) return null;
    const sound = this.play(key, category, config);
    if (sound && cooldownMs > 0) this.setCooldown(key, cooldownMs);
    return sound;
  }

  public playVariantWithCooldown(
    baseKey: string,
    variantCount: number,
    category: AudioCategory,
    cooldownMs: number,
    config?: Phaser.Types.Sound.SoundConfig,
  ): Phaser.Sound.BaseSound | null {
    if (!Number.isInteger(variantCount) || variantCount < 1) return null;
    if (this.isOnCooldown(baseKey)) return null;
    const key = `${baseKey}_${this.rng.int(variantCount) + 1}`;
    const sound = this.play(key, category, config);
    if (sound && cooldownMs > 0) this.setCooldown(baseKey, cooldownMs);
    return sound;
  }

  public playPositionalWithCooldown(
    config: PositionalAudioConfig,
    playerX: number,
    playerY: number,
    cooldownMs: number,
  ): Phaser.Sound.BaseSound | null {
    if (this.isOnCooldown(config.key)) return null;
    const sound = this.playPositional(config, playerX, playerY);
    if (sound && cooldownMs > 0) this.setCooldown(config.key, cooldownMs);
    return sound;
  }

  private isAudioAvailable(key: string): boolean {
    // Keys outside the allowlist are intentionally silent (the current
    // manifest is empty until real audio files are checked in).
    if (!Object.hasOwn(AUDIO_ASSET_MANIFEST, key)) return false;

    try {
      if (this.scene.cache.audio.exists(key)) return true;
    } catch (error) {
      this.warnUnavailableAudio(key, error);
      return false;
    }

    this.warnUnavailableAudio(key);
    return false;
  }

  private warnUnavailableAudio(key: string, error?: unknown) {
    if (AudioDirector.warnedUnavailableAudio.has(key)) return;
    AudioDirector.warnedUnavailableAudio.add(key);
    if (error) console.warn(`[AudioDirector] Skipping unavailable audio: ${key}`, error);
    else console.warn(`[AudioDirector] Skipping unavailable audio: ${key}`);
  }
  
  public playVariant(baseKey: string, variantCount: number, category: AudioCategory = 'sfx', config?: Phaser.Types.Sound.SoundConfig): Phaser.Sound.BaseSound | null {
    // Select random variant
    const variant = this.rng.int(variantCount) + 1;
    const key = `${baseKey}_${variant}`;
    
    return this.play(key, category, config);
  }
  
  public stop(key: string) {
    const sound = this.activeSounds.get(key);
    if (sound && sound.isPlaying) {
      sound.stop();
      this.activeSounds.delete(key);
    }
  }
  
  public stopAll() {
    this.activeSounds.forEach((sound, key) => {
      if (sound.isPlaying) {
        sound.stop();
      }
    });
    this.activeSounds.clear();
  }
  
  public stopCategory(category: AudioCategory) {
    this.activeSounds.forEach((sound, key) => {
      if (this.getSoundCategory(key) === category) {
        if (sound.isPlaying) sound.stop();
        this.activeSounds.delete(key);
      }
    });
  }

  /** Fade a presentation audio category, then stop and release its sound handles. */
  public fadeOutCategory(category: AudioCategory, durationMs: number) {
    this.activeSounds.forEach((sound, key) => {
      if (this.getSoundCategory(key) !== category) return;
      const fade = Math.max(0, durationMs);
      if (!sound.isPlaying || fade === 0 || !this.scene.tweens) {
        sound.stop();
        this.activeSounds.delete(key);
        return;
      }
      try {
        this.scene.tweens.add({
          targets: sound,
          volume: 0,
          duration: fade,
          onComplete: () => {
            sound.stop();
            if (this.activeSounds.get(key) === sound) this.activeSounds.delete(key);
          },
        });
      } catch {
        sound.stop();
        this.activeSounds.delete(key);
      }
    });
  }
  
  // ====== COOLDOWN SYSTEM ======
  
  public setCooldown(key: string, cooldownMs: number) {
    this.cooldowns.set(key, {
      lastPlayed: Date.now(),
      cooldown: cooldownMs,
    });
  }
  
  private isOnCooldown(key: string): boolean {
    const cooldown = this.cooldowns.get(key);
    if (!cooldown) return false;
    
    const now = Date.now();
    const elapsed = now - cooldown.lastPlayed;
    
    if (elapsed < cooldown.cooldown) {
      return true;
    }
    
    // Cooldown expired, remove it
    this.cooldowns.delete(key);
    return false;
  }
  
  // ====== HORROR AUDIO RULES ======
  
  public setMajorScareAudioActive(active: boolean) {
    this.majorScareAudioActive = active;
    
    if (active) {
      // Reduce ambience during major scares
      this.activeSounds.forEach((sound, key) => {
        if (key.startsWith('amb_') && sound.isPlaying) {
          // Cannot directly change volume on BaseSound
          // Stop ambience sounds during major scares instead
          sound.stop();
        }
      });
    } else {
      // Ambience will naturally resume via normal gameplay loops
    }
  }
  
  public isMajorScareAudioActive(): boolean {
    return this.majorScareAudioActive;
  }
  
  // ====== CLEANUP ======
  
  public shutdown() {
    this.stopAll();
    this.cooldowns.clear();
  }
}

// Audio key constants for centralized management
export const AUDIO_KEYS = {
  // PLAYER
  player: {
    footstep: 'sfx_player_footstep', // Has variants _1, _2, _3
    footstepVariants: 3,
    footstepSprint: 'sfx_player_footstep_sprint',
    hurt: 'sfx_player_hurt', // Has variants _1 and _2
    hurtVariants: 2,
    death: 'sfx_player_death',
    breathingLow: 'sfx_player_breathing_low',
  },
  
  // INTERACTION
  interaction: {
    containerOpen: 'sfx_interaction_search',
    keyPickup: 'sfx_key_pickup',
    itemPickup: 'sfx_item_pickup',
    healing: 'sfx_item_heal',
    locked: 'sfx_interaction_locked',
    unlock: 'sfx_interaction_unlock',
    floorTransition: 'sfx_floor_transition',
  },
  
  // FLASHLIGHT
  flashlight: {
    on: 'sfx_flashlight_on',
    off: 'sfx_flashlight_off',
    flicker: 'sfx_flashlight_flicker',
    depleted: 'sfx_battery_warning',
  },
  
  // ENVIRONMENT
  environment: {
    fluorescentHum: 'amb_environment_fluorescent_hum',
    creak: 'amb_environment_creak', // Has variants
    creakVariants: 3,
    distantImpact: 'amb_environment_distant_impact',
    drippingWater: 'amb_environment_dripping_water',
  },
  
  // STALKER
  stalker: {
    distantMovement: 'sfx_stalker_distant_movement',
    footsteps: 'sfx_stalker_footsteps',
    breathing: 'sfx_stalker_breathing',
    detected: 'sfx_stalker_detected',
    chase: 'sfx_stalker_chase',
    attack: 'sfx_stalker_attack',
    presence: 'sfx_stalker_presence',
    hunt: 'sfx_stalker_hunt',
  },
  
  // CRAWLER
  crawler: {
    movement: 'sfx_crawler_movement',
    detection: 'sfx_crawler_detection',
    attack: 'sfx_crawler_attack',
    skitter: 'sfx_crawler_skitter',
  },
  
  // WATCHER
  watcher: {
    presence: 'amb_watcher_presence',
    disappear: 'sfx_watcher_disappear',
  },
  
  // MIMIC
  mimic: {
    tell: 'sfx_mimic_tell',
    reveal: 'sfx_mimic_reveal',
    attack: 'sfx_mimic_attack',
  },
  
  // AMBUSHER
  ambusher: {
    preScare: 'sfx_ambusher_pre_scare',
    scream: 'sfx_ambusher_scream',
    impact: 'sfx_ambusher_impact',
  },
  
  // JUMPSCARES
  jumpscares: {
    lidSlam: 'sfx_jumpscare_lid_slam',
    handInside: 'sfx_jumpscare_hand_inside',
    objectFalls: 'sfx_jumpscare_object_falls',
    whisper: 'sfx_jumpscare_whisper',
    screenGlitch: 'sfx_jumpscare_screen_glitch',
    falseMimic: 'sfx_jumpscare_false_mimic',
    wallShift: 'sfx_jumpscare_wall_shift',
    shadowFigure: 'sfx_jumpscare_shadow_figure',
    doorSlam: 'sfx_jumpscare_door_slam',
    footsteps: 'sfx_jumpscare_footsteps',
    falseStalker: 'sfx_jumpscare_false_stalker',
    suddenNoise: 'sfx_jumpscare_sudden_noise',
  },
  
  // PROGRESSION
  progression: {
    keyFound: 'sfx_progression_key_found',
    block13Reveal: 'sfx_progression_block13_reveal',
    objectiveComplete: 'sfx_progression_objective_complete',
    victory: 'sfx_progression_victory',
    block13Arrival: 'sfx_block13_reveal',
    finalChase: 'sfx_final_chase_stinger',
    escape: 'sfx_escape',
  },
  
  // AMBIENCE (looping)
  ambience: {
    floorGeneral: 'amb_floor_general',
    floorDeep: 'amb_floor_deep',
    block13: 'amb_block13',
    roomTone: 'amb_room_tone',
    floor4: 'amb_floor_4',
    floor3: 'amb_floor_3',
    floor2: 'amb_floor_2',
    floor1: 'amb_floor_1',
  },
  
  // MUSIC
  music: {
    mainTheme: 'music_main_theme',
    chaseTheme: 'music_chase_theme',
  },
};
