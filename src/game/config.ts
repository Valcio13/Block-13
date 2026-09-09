import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { FloorScene } from './scenes/FloorScene';
import type { RunState } from '../core/run';

export function createGameConfig(parent: string, runState: RunState): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent,
    backgroundColor: '#07090d',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [BootScene, FloorScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // Pass run state through game registry
    callbacks: {
      preBoot: (game) => {
        game.registry.set('runState', runState);
      },
    },
  };
}
