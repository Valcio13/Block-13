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
export type ArchitecturalMark = 'orderly_seam' | 'clean_wall' | 'peel' | 'warning_repeat' | 'fracture' | 'paradox_wall' | null;

export interface SurfaceColorGrade { tint: number; alpha: number; }

/** Subtle material-only color grading; this does not touch the runtime light levels. */
const SURFACE_COLOR_GRADES: Readonly<Record<number, { floor: SurfaceColorGrade; wall: SurfaceColorGrade }>> = {
  4: { floor: { tint: 0x988f7e, alpha: 0.10 }, wall: { tint: 0x75828a, alpha: 0.12 } },
  3: { floor: { tint: 0x987957, alpha: 0.12 }, wall: { tint: 0x806f5c, alpha: 0.13 } },
  2: { floor: { tint: 0x668b94, alpha: 0.13 }, wall: { tint: 0x527481, alpha: 0.14 } },
  1: { floor: { tint: 0x866b91, alpha: 0.15 }, wall: { tint: 0x644d75, alpha: 0.16 } },
  0: { floor: { tint: 0x914b65, alpha: 0.12 }, wall: { tint: 0x704654, alpha: 0.15 } },
};

/** One restrained material tint per floor, shared by its authored floor/wall tiles. */
export function surfaceColorGrade(floor: number, walkable: boolean): SurfaceColorGrade {
  const index = Math.max(0, Math.min(4, Math.trunc(floor)));
  return SURFACE_COLOR_GRADES[index][walkable ? 'floor' : 'wall'];
}

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

/** Lower ambient bounce progressively while keeping the existing light radius. */
export function floorAmbientVisibility(floor: number): number {
  // Relative to the prior pass: Block 4 ambient is cut by 26%, with a
  // progressively stronger cut on lower floors so the beam leads visibility.
  return [0.42, 0.50, 0.58, 0.66, 0.74][Math.max(0, Math.min(4, Math.trunc(floor)))] ?? 0.74;
}

/** Contrast gain applies only to the rendered beam, not its range or mechanics. */
export function floorFlashlightContrast(floor: number): number {
  return [1.14, 1.12, 1.09, 1.05, 1.02][Math.max(0, Math.min(4, Math.trunc(floor)))] ?? 1.02;
}

/** Stable integer coordinate hash; cosmetic placement never advances gameplay RNG. */
export function tileDressingAt(floor: number, x: number, y: number, walkable: boolean): TileDressing {
  let hash = Math.imul((x + 0x9e3779b9) | 0, 0x85ebca6b);
  hash = Math.imul(hash ^ (y + 0x7f4a7c15), 0xc2b2ae35);
  hash = Math.imul(hash ^ (floor + 17), 0x27d4eb2d) >>> 0;
  const roll = hash % 100;
  if (walkable) {
    if (floor <= 1 && roll < (floor === 0 ? 9 : 7)) return 'corruption';
    if (floor === 3) {
      if (roll < 8) return 'stain';
      if (roll < 10) return 'crack';
      return 'none';
    }
    if (floor === 4) {
      if (roll < 4) return 'stain';
      if (roll < 5) return 'crack';
      return 'none';
    }
    if (floor === 2) {
      if (roll < 7) return 'stain';
      if (roll < 9) return 'crack';
      if (roll === 99) return 'warning';
      return 'none';
    }
    if (roll < 12) return 'stain';
    if (roll < 17) return 'crack';
    return 'none';
  }
  if (floor === 3 && roll < 4) return 'pipe';
  if (floor === 3) return roll >= 4 && roll < 16 ? 'crack' : 'none';
  if (floor <= 3 && roll < (floor === 2 ? 5 : 8)) return 'pipe';
  if (floor === 2 && roll >= 98 && roll < 100) return 'warning';
  const wallCrackLimit = floor === 4 ? 12 : floor === 2 ? 13 : 18;
  if (roll < wallCrackLimit) return 'crack';
  return 'none';
}

/** Sparse, coordinate-derived surface language layered over existing map tiles. */
export function architecturalMarkAt(floor: number, x: number, y: number, walkable: boolean): ArchitecturalMark {
  let hash = Math.imul((x + 0x632be5ab) | 0, 0x9e3779b1);
  hash = Math.imul(hash ^ (y + 0x85157af5), 0x85ebca77) >>> 0;
  switch (floor) {
    case 4:
      if (walkable && y % 4 === 0 && (x + y) % 3 === 0) return 'orderly_seam';
      if (!walkable && hash % 11 === 0) return 'clean_wall';
      return null;
    case 3:
      if (!walkable && hash % 19 === 0) return 'peel';
      return null;
    case 2:
      return (hash + x * 7 + y * 13) % 31 === 0 ? 'warning_repeat' : null;
    case 1:
      return hash % 13 === 0 ? 'fracture' : null;
    case 0:
      return !walkable && (x * 5 + y * 3) % 7 === 0 ? 'paradox_wall' : null;
    default:
      return null;
  }
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
