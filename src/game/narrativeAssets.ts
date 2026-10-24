import { assetPath } from '../core/assetPath';

/** Authored exterior plate used only by the win-only presentation epilogue. */
export const NARRATIVE_ASSET_MANIFEST = {
  opening_arrival: {
    key: 'opening_arrival',
    path: assetPath('sprites/narrative/floor13-opening/scene_01_arrival.png'),
    width: 320,
    height: 180,
  },
  opening_message: {
    key: 'opening_message',
    path: assetPath('sprites/narrative/floor13-opening/scene_02_message.png'),
    width: 320,
    height: 180,
  },
  opening_entering: {
    key: 'opening_entering',
    path: assetPath('sprites/narrative/floor13-opening/scene_03_entering.png'),
    width: 320,
    height: 180,
  },
  opening_ascending: {
    key: 'opening_ascending',
    path: assetPath('sprites/narrative/floor13-opening/scene_04_ascending.png'),
    width: 320,
    height: 180,
  },
  opening_floor4: {
    key: 'opening_floor4',
    path: assetPath('sprites/narrative/floor13-opening/scene_05_floor4.png'),
    width: 320,
    height: 180,
  },
  victory_exterior_bg: {
    key: 'victory_exterior_bg',
    path: assetPath('sprites/narrative/abandoned-apartment.png'),
    width: 1672,
    height: 941,
  },
} as const;

export function victoryExteriorScale(viewWidth: number, viewHeight: number): { x: number; y: number } {
  const asset = NARRATIVE_ASSET_MANIFEST.victory_exterior_bg;
  const scale = Math.max(viewWidth / asset.width, viewHeight / asset.height);
  return { x: scale, y: scale };
}

export const OPENING_CINEMATIC = [
  { texture: 'opening_arrival', durationMs: 1_700, caption: '' },
  { texture: 'opening_message', durationMs: 1_700, caption: 'Fourth floor. You need to see this.' },
  { texture: 'opening_entering', durationMs: 1_700, caption: '' },
  { texture: 'opening_ascending', durationMs: 1_700, caption: '' },
  { texture: 'opening_floor4', durationMs: 1_700, caption: 'FLOOR 4' },
] as const;

export const OPENING_CINEMATIC_DURATION_MS = OPENING_CINEMATIC.reduce((total, scene) => total + scene.durationMs, 0);

export function shouldPlayOpeningCinematic(input: {
  floor: number;
  tick: number;
  replay: boolean;
  recovery: boolean;
  alreadySeen: boolean;
}): boolean {
  return input.floor === 4 && input.tick === 0 && !input.replay && !input.recovery && !input.alreadySeen;
}
