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
    if (!this.scene.cache.audio.exists(key)) {
      // Gracefully handle missing asset
      console.warn(`[AudioDirector] Missing audio asset: ${key}`);
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
    
    const sound = this.scene.sound.add(key, {
      ...config,
      volume,
    });
    
    sound.play();
    
    // Track active sound
    this.activeSounds.set(key, sound);
    
    sound.once('complete', () => {
      this.activeSounds.delete(key);
    });
    
    return sound;
  }
  
  public playPositional(config: PositionalAudioConfig, playerX: number, playerY: number): Phaser.Sound.BaseSound | null {
    // Check if asset exists
    if (!this.scene.cache.audio.exists(config.key)) {
      console.warn(`[AudioDirector] Missing positional audio asset: ${config.key}`);
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
    
    const sound = this.scene.sound.add(config.key, {
      volume,
      loop: config.loop || false,
    });
    
    // Apply pan if supported (HTML5 Audio supports this)
    if ('pan' in sound && typeof (sound as any).pan !== 'undefined') {
      (sound as any).pan = pan;
    }
    
    sound.play();
    
    // Track active sound
    const trackingKey = `${config.key}_${config.x}_${config.y}`;
    this.activeSounds.set(trackingKey, sound);
    
    sound.once('complete', () => {
      this.activeSounds.delete(trackingKey);
    });
    
    return sound;
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
      if (this.getSoundCategory(key) === category && sound.isPlaying) {
        sound.stop();
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
    footstepVariants: 4,
    footstepSprint: 'sfx_player_footstep_sprint',
    hurt: 'sfx_player_hurt',
    breathingLow: 'sfx_player_breathing_low',
  },
  
  // INTERACTION
  interaction: {
    containerOpen: 'sfx_interaction_container_open',
    keyPickup: 'sfx_interaction_key_pickup',
    locked: 'sfx_interaction_locked',
    unlock: 'sfx_interaction_unlock',
    floorTransition: 'sfx_interaction_floor_transition',
  },
  
  // FLASHLIGHT
  flashlight: {
    on: 'sfx_flashlight_on',
    off: 'sfx_flashlight_off',
    flicker: 'sfx_flashlight_flicker',
    depleted: 'sfx_flashlight_depleted',
  },
  
  // ENVIRONMENT
  environment: {
    fluorescentHum: 'amb_environment_fluorescent_hum',
    creak: 'amb_environment_creak', // Has variants
    creakVariants: 3,
    distantImpact: 'amb_environment_distant_impact',
    drippingWater: 'amb_environment_dripping_water',
    movingWall: 'sfx_environment_moving_wall',
  },
  
  // STALKER
  stalker: {
    distantMovement: 'sfx_stalker_distant_movement',
    footsteps: 'sfx_stalker_footsteps',
    breathing: 'sfx_stalker_breathing',
    detected: 'sfx_stalker_detected',
    chase: 'sfx_stalker_chase',
    attack: 'sfx_stalker_attack',
  },
  
  // CRAWLER
  crawler: {
    movement: 'sfx_crawler_movement',
    detection: 'sfx_crawler_detection',
    attack: 'sfx_crawler_attack',
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
  },
  
  // AMBIENCE (looping)
  ambience: {
    floorGeneral: 'amb_floor_general',
    floorDeep: 'amb_floor_deep',
    block13: 'amb_block13',
  },
  
  // MUSIC
  music: {
    mainTheme: 'music_main_theme',
    chaseTheme: 'music_chase_theme',
  },
};
