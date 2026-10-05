/** Presentation-only palette and tile dressing. This module has no RNG or Phaser dependency. */
export interface FloorVisualProfile {
  floor: number;
  floorBase: number;
  wallBase: number;
  grid: number;
  grime: number;
  stain: number;
  accent: number;
  darkness: number;
  ambient: number;
  flashlight: number;
  corruption: number;
}

export type TileDressing = 'none' | 'stain' | 'crack' | 'pipe' | 'warning' | 'corruption';

const PROFILES: Record<number, FloorVisualProfile> = {
  4: { floor: 4, floorBase: 0x202832, wallBase: 0x10151b, grid: 0x34404b, grime: 0x43474a, stain: 0x121a20, accent: 0x8da0aa, darkness: 0x252933, ambient: 0x999fa8, flashlight: 0xdfe8ee, corruption: 0x596075 },
  3: { floor: 3, floorBase: 0x211f20, wallBase: 0x151414, grid: 0x3b3633, grime: 0x655747, stain: 0x11100f, accent: 0x9a7851, darkness: 0x252321, ambient: 0x99928b, flashlight: 0xe4ded5, corruption: 0x695643 },
  2: { floor: 2, floorBase: 0x1b2329, wallBase: 0x0e151a, grid: 0x34424b, grime: 0x48555a, stain: 0x11191d, accent: 0x94c4ca, darkness: 0x202a32, ambient: 0x91a6ad, flashlight: 0xd9f0f3, corruption: 0x58848a },
  1: { floor: 1, floorBase: 0x211d27, wallBase: 0x100e17, grid: 0x393142, grime: 0x5b465c, stain: 0x120f18, accent: 0xb28aa8, darkness: 0x28212e, ambient: 0x95879b, flashlight: 0xeadcf0, corruption: 0x815184 },
  0: { floor: 0, floorBase: 0x241c27, wallBase: 0x100d18, grid: 0x3a2b3f, grime: 0x70444f, stain: 0x120d18, accent: 0xc07883, darkness: 0x2a202d, ambient: 0x9a8796, flashlight: 0xf0dce7, corruption: 0xa24763 },
};

export function floorVisualProfile(floor: number): FloorVisualProfile {
  return PROFILES[Math.max(0, Math.min(4, Math.trunc(floor)))] ?? PROFILES[4];
}

/** Stable integer coordinate hash; cosmetic placement never advances gameplay RNG. */
export function tileDressingAt(floor: number, x: number, y: number, walkable: boolean): TileDressing {
  let hash = Math.imul((x + 0x9e3779b9) | 0, 0x85ebca6b);
  hash = Math.imul(hash ^ (y + 0x7f4a7c15), 0xc2b2ae35);
  hash = Math.imul(hash ^ (floor + 17), 0x27d4eb2d) >>> 0;
  const roll = hash % 100;
  if (walkable) {
    if (floor <= 1 && roll < (floor === 0 ? 9 : 7)) return 'corruption';
    if (roll < (floor <= 2 ? 17 : 12)) return 'stain';
    if (roll < (floor <= 2 ? 22 : 15)) return 'crack';
    if (floor === 2 && roll >= 96) return 'warning';
    return 'none';
  }
  if (floor <= 3 && roll < 8) return 'pipe';
  if (floor <= 2 && roll >= 92 && roll < 96) return 'warning';
  if (roll < 24) return 'crack';
  return 'none';
}

/** A very small, tick-derived light variation; value is always within ±2.5%. */
export function flashlightVisualFactor(tick: number, floor: number): number {
  if (floor > 2) return 1;
  const phase = (Math.trunc(tick) * 17 + floor * 31) % 257;
  return 0.975 + (phase < 7 ? phase * 0.0025 : Math.sin(phase * 0.024) * 0.0125 + 0.0125);
}

export function corruptionVisualStrength(floor: number, intensityPermille: number): number {
  const floorBaseline = floor === 0 ? 0.055 : floor === 1 ? 0.04 : floor === 2 ? 0.018 : 0;
  return Math.min(0.22, floorBaseline + Math.max(0, Math.min(1000, intensityPermille)) / 1000 * 0.16);
}
