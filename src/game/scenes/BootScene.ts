import Phaser from 'phaser';
import { AUDIO_KEYS } from '../../core/audioDirector';
import type { RunState } from '../../core/run';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Create loading text
    const { width, height } = this.cameras.main;
    const loadingText = this.add.text(width / 2, height / 2, 'LOADING...', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#70d4c6',
    });
    loadingText.setOrigin(0.5);

    // Progress bar
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x1d4945, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 + 40, 320, 30);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x70d4c6, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 + 45, 300 * value, 20);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Load audio assets
    this.loadAudioAssets();
  }
  
  private loadAudioAssets() {
    // Helper function to derive file path from audio key
    const getAudioPath = (key: string): string => {
      // Map key prefix to directory
      if (key.startsWith('sfx_player_')) return `assets/audio/player/${key}.ogg`;
      if (key.startsWith('sfx_interaction_')) return `assets/audio/interactions/${key}.ogg`;
      if (key.startsWith('sfx_flashlight_')) return `assets/audio/flashlight/${key}.ogg`;
      if (key.startsWith('amb_environment_') || key.startsWith('sfx_environment_')) return `assets/audio/environment/${key}.ogg`;
      if (key.startsWith('sfx_stalker_')) return `assets/audio/enemies/stalker/${key}.ogg`;
      if (key.startsWith('sfx_crawler_')) return `assets/audio/enemies/crawler/${key}.ogg`;
      if (key.startsWith('amb_watcher_') || key.startsWith('sfx_watcher_')) return `assets/audio/enemies/watcher/${key}.ogg`;
      if (key.startsWith('sfx_mimic_')) return `assets/audio/enemies/mimic/${key}.ogg`;
      if (key.startsWith('sfx_ambusher_')) return `assets/audio/enemies/ambusher/${key}.ogg`;
      if (key.startsWith('sfx_jumpscare_')) return `assets/audio/jumpscares/${key}.ogg`;
      if (key.startsWith('sfx_progression_')) return `assets/audio/progression/${key}.ogg`;
      if (key.startsWith('amb_floor') || key.startsWith('amb_block')) return `assets/audio/ambience/${key}.ogg`;
      if (key.startsWith('music_')) return `assets/audio/music/${key}.ogg`;
      
      // Fallback
      return `assets/audio/${key}.ogg`;
    };
    
    // Collect all audio keys from AUDIO_KEYS constant
    const audioKeys: string[] = [];
    
    // Player sounds
    if (AUDIO_KEYS.player.footstepVariants > 0) {
      for (let i = 1; i <= AUDIO_KEYS.player.footstepVariants; i++) {
        audioKeys.push(`${AUDIO_KEYS.player.footstep}_${i}`);
      }
    }
    audioKeys.push(AUDIO_KEYS.player.footstepSprint);
    audioKeys.push(AUDIO_KEYS.player.hurt);
    audioKeys.push(AUDIO_KEYS.player.breathingLow);
    
    // Interaction sounds
    audioKeys.push(AUDIO_KEYS.interaction.containerOpen);
    audioKeys.push(AUDIO_KEYS.interaction.keyPickup);
    audioKeys.push(AUDIO_KEYS.interaction.locked);
    audioKeys.push(AUDIO_KEYS.interaction.unlock);
    audioKeys.push(AUDIO_KEYS.interaction.floorTransition);
    
    // Flashlight sounds
    audioKeys.push(AUDIO_KEYS.flashlight.on);
    audioKeys.push(AUDIO_KEYS.flashlight.off);
    audioKeys.push(AUDIO_KEYS.flashlight.flicker);
    audioKeys.push(AUDIO_KEYS.flashlight.depleted);
    
    // Environment sounds
    audioKeys.push(AUDIO_KEYS.environment.fluorescentHum);
    if (AUDIO_KEYS.environment.creakVariants > 0) {
      for (let i = 1; i <= AUDIO_KEYS.environment.creakVariants; i++) {
        audioKeys.push(`${AUDIO_KEYS.environment.creak}_${i}`);
      }
    }
    audioKeys.push(AUDIO_KEYS.environment.distantImpact);
    audioKeys.push(AUDIO_KEYS.environment.drippingWater);
    audioKeys.push(AUDIO_KEYS.environment.movingWall);
    
    // Stalker sounds
    audioKeys.push(AUDIO_KEYS.stalker.distantMovement);
    audioKeys.push(AUDIO_KEYS.stalker.footsteps);
    audioKeys.push(AUDIO_KEYS.stalker.breathing);
    audioKeys.push(AUDIO_KEYS.stalker.detected);
    audioKeys.push(AUDIO_KEYS.stalker.chase);
    audioKeys.push(AUDIO_KEYS.stalker.attack);
    
    // Crawler sounds
    audioKeys.push(AUDIO_KEYS.crawler.movement);
    audioKeys.push(AUDIO_KEYS.crawler.detection);
    audioKeys.push(AUDIO_KEYS.crawler.attack);
    
    // Watcher sounds
    audioKeys.push(AUDIO_KEYS.watcher.presence);
    audioKeys.push(AUDIO_KEYS.watcher.disappear);
    
    // Mimic sounds
    audioKeys.push(AUDIO_KEYS.mimic.tell);
    audioKeys.push(AUDIO_KEYS.mimic.reveal);
    audioKeys.push(AUDIO_KEYS.mimic.attack);
    
    // Ambusher sounds
    audioKeys.push(AUDIO_KEYS.ambusher.preScare);
    audioKeys.push(AUDIO_KEYS.ambusher.scream);
    audioKeys.push(AUDIO_KEYS.ambusher.impact);
    
    // Jumpscare sounds
    audioKeys.push(AUDIO_KEYS.jumpscares.lidSlam);
    audioKeys.push(AUDIO_KEYS.jumpscares.handInside);
    audioKeys.push(AUDIO_KEYS.jumpscares.objectFalls);
    audioKeys.push(AUDIO_KEYS.jumpscares.whisper);
    audioKeys.push(AUDIO_KEYS.jumpscares.screenGlitch);
    audioKeys.push(AUDIO_KEYS.jumpscares.falseMimic);
    audioKeys.push(AUDIO_KEYS.jumpscares.wallShift);
    audioKeys.push(AUDIO_KEYS.jumpscares.shadowFigure);
    audioKeys.push(AUDIO_KEYS.jumpscares.doorSlam);
    audioKeys.push(AUDIO_KEYS.jumpscares.footsteps);
    audioKeys.push(AUDIO_KEYS.jumpscares.falseStalker);
    audioKeys.push(AUDIO_KEYS.jumpscares.suddenNoise);
    
    // Progression sounds
    audioKeys.push(AUDIO_KEYS.progression.keyFound);
    audioKeys.push(AUDIO_KEYS.progression.block13Reveal);
    audioKeys.push(AUDIO_KEYS.progression.objectiveComplete);
    audioKeys.push(AUDIO_KEYS.progression.victory);
    
    // Ambience sounds
    audioKeys.push(AUDIO_KEYS.ambience.floorGeneral);
    audioKeys.push(AUDIO_KEYS.ambience.floorDeep);
    audioKeys.push(AUDIO_KEYS.ambience.block13);
    
    // Music (optional)
    audioKeys.push(AUDIO_KEYS.music.mainTheme);
    audioKeys.push(AUDIO_KEYS.music.chaseTheme);
    
    // Load all audio assets
    audioKeys.forEach(key => {
      const path = getAudioPath(key);
      this.load.audio(key, path);
    });
    
    // Log how many audio files we're attempting to load
    console.log(`[BootScene] Preloading ${audioKeys.length} audio assets...`);
  }

  create() {
    // Get run state from registry
    const runState = this.registry.get('runState') as RunState;
    
    // Boot complete, transition to floor scene
    this.scene.start('FloorScene', { runState });
  }
}
