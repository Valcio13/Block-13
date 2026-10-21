import Phaser from 'phaser';
import { AUDIO_ASSET_MANIFEST } from '../../core/audioAssetManifest';
import type { RunState } from '../../core/run';
import { BLOCK13_ASSET_MANIFEST } from '../block13Assets';
import { PLAYER_ASSET_MANIFEST, PLAYER_WALK_ASSET_MANIFEST } from '../playerAssets';
import { ORDINARY_ENVIRONMENT_ASSET_MANIFEST } from '../environmentAssets';
import { STALKER_IDLE_ASSET_MANIFEST, STALKER_WALK_ASSET_MANIFEST } from '../stalkerAssets';
import { AMBUSHER_JUMPSCARE_VARIANT_ASSETS, CONTAINER_SCARE_VARIANT_ASSETS, ENEMY_ASSET_MANIFEST, LAMP_JUMPSCARE_VARIANT_ASSETS } from '../enemyAssets';
import { NARRATIVE_ASSET_MANIFEST } from '../narrativeAssets';
import { BLOCK3_REFINED_EXPERIMENT_ASSETS } from '../block3VisualExperiment';

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
    this.loadBlock13VisualAssets();
    this.loadOrdinaryEnvironmentAssets();
    this.loadDevelopmentBlock3ExperimentAssets();
    this.loadPlayerVisualAssets();
    this.loadStalkerVisualAssets();
    this.loadRemainingVisualAssets();
  }
  
  private loadAudioAssets() {
    const entries = Object.entries(AUDIO_ASSET_MANIFEST);
    for (const [key, path] of entries) this.load.audio(key, path);
    console.log(`[BootScene] Preloading ${entries.length} available audio assets...`);
  }

  private loadBlock13VisualAssets() {
    for (const asset of Object.values(BLOCK13_ASSET_MANIFEST)) {
      this.load.image(asset.key, asset.path);
    }
  }

  private loadOrdinaryEnvironmentAssets() {
    for (const asset of Object.values(ORDINARY_ENVIRONMENT_ASSET_MANIFEST)) {
      this.load.image(asset.key, asset.path);
    }
  }

  /** These files are outside public/ and are queued only by the Vite dev server. */
  private loadDevelopmentBlock3ExperimentAssets() {
    if (!import.meta.env.DEV) return;
    for (const asset of BLOCK3_REFINED_EXPERIMENT_ASSETS) {
      this.load.image(
        asset.key,
        `/art-experiments/block3-redesign/assets/refined_candidate/${asset.file}`,
      );
    }
  }

  private loadPlayerVisualAssets() {
    for (const asset of [...Object.values(PLAYER_ASSET_MANIFEST), ...Object.values(PLAYER_WALK_ASSET_MANIFEST)]) {
      this.load.image(asset.key, asset.path);
    }
  }

  private loadStalkerVisualAssets() {
    for (const asset of [...Object.values(STALKER_IDLE_ASSET_MANIFEST), ...Object.values(STALKER_WALK_ASSET_MANIFEST)]) {
      this.load.image(asset.key, asset.path);
    }
  }

  private loadRemainingVisualAssets() {
    for (const asset of Object.values(ENEMY_ASSET_MANIFEST)) this.load.image(asset.key, asset.path);
    // Missing optional compositions fail closed to the face/world/procedural chain.
    for (const asset of Object.values(AMBUSHER_JUMPSCARE_VARIANT_ASSETS)) this.load.image(asset.key, asset.path);
    for (const asset of CONTAINER_SCARE_VARIANT_ASSETS) this.load.image(asset.key, asset.path);
    for (const asset of LAMP_JUMPSCARE_VARIANT_ASSETS) this.load.image(asset.key, asset.path);
    for (const asset of Object.values(NARRATIVE_ASSET_MANIFEST)) this.load.image(asset.key, asset.path);
    this.load.on('filecomplete', (_key: string, _type: string, _data: unknown) => {
      for (const asset of Object.values(NARRATIVE_ASSET_MANIFEST)) {
        if (this.textures.exists(asset.key)) this.textures.get(asset.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    });
  }

  create() {
    // Get run state from registry
    const runState = this.registry.get('runState') as RunState;
    const replayLog = this.registry.get('replayLog') as Uint8Array | undefined;
    
    // Boot complete, transition to floor scene
    this.scene.start('FloorScene', { runState, replayLog });
  }
}
