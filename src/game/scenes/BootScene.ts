import Phaser from 'phaser';
import { AUDIO_ASSET_MANIFEST } from '../../core/audioAssetManifest';
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
    const entries = Object.entries(AUDIO_ASSET_MANIFEST);
    for (const [key, path] of entries) this.load.audio(key, path);
    console.log(`[BootScene] Preloading ${entries.length} available audio assets...`);
  }

  create() {
    // Get run state from registry
    const runState = this.registry.get('runState') as RunState;
    const replayLog = this.registry.get('replayLog') as Uint8Array | undefined;
    
    // Boot complete, transition to floor scene
    this.scene.start('FloorScene', { runState, replayLog });
  }
}
