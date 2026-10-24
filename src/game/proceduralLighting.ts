/** Presentation-only environmental light assignment. No Phaser or simulation RNG. */
export type EnvironmentalLightType = 'stable' | 'dim' | 'flickering' | 'failing' | 'broken';

export interface EnvironmentalLightProfile {
  type: EnvironmentalLightType;
  seed: number;
  phase: number;
  baseBrightness: number;
}

function hash(seed: number, value: number): number {
  let result = Math.imul((seed ^ 0x9e3779b9) | 0, 0x85ebca6b);
  result = Math.imul(result ^ Math.imul(value | 0, 0xc2b2ae35), 0x27d4eb2d);
  return (result ^ (result >>> 16)) >>> 0;
}

function unit(seed: number, value: number): number {
  return hash(seed, value) / 0xffff_ffff;
}

/** Stable floor-specific distribution; the fixture id is part of the cosmetic seed. */
export function environmentalLightProfile(floor: number, fixtureId: number, seed: number): EnvironmentalLightProfile {
  const normalizedFloor = Math.max(0, Math.min(4, Math.trunc(floor)));
  const roll = hash(seed ^ normalizedFloor * 0x45d9f3b, fixtureId) % 100;
  let type: EnvironmentalLightType;
  if (normalizedFloor === 4) type = roll < 60 ? 'stable' : roll < 85 ? 'dim' : 'flickering';
  else if (normalizedFloor === 3) type = roll < 52 ? 'stable' : roll < 77 ? 'dim' : 'flickering';
  else if (normalizedFloor === 2) type = roll < 42 ? 'stable' : roll < 68 ? 'dim' : roll < 88 ? 'flickering' : roll < 96 ? 'failing' : 'broken';
  else if (normalizedFloor === 1) type = roll < 32 ? 'stable' : roll < 58 ? 'dim' : roll < 82 ? 'flickering' : roll < 94 ? 'failing' : 'broken';
  else type = roll < 35 ? 'stable' : roll < 56 ? 'dim' : roll < 82 ? 'flickering' : roll < 95 ? 'failing' : 'broken';
  const profileSeed = hash(seed, fixtureId ^ 0x632be5ab);
  const baseBrightness = type === 'stable' ? 0.72 + unit(profileSeed, 1) * 0.24
    : type === 'dim' ? 0.26 + unit(profileSeed, 2) * 0.18
      : type === 'flickering' ? 0.68 + unit(profileSeed, 3) * 0.2
        : type === 'failing' ? 0.03 + unit(profileSeed, 4) * 0.08 : 0;
  return { type, seed: profileSeed, phase: unit(profileSeed, 5) * Math.PI * 2, baseBrightness };
}

/** Reproducible brightness sample. Stable and broken fixtures never animate. */
export function environmentalLightBrightness(profile: EnvironmentalLightProfile, tick: number): number {
  if (profile.type === 'broken') return 0;
  if (profile.type === 'stable' || profile.type === 'dim') return profile.baseBrightness;
  const safeTick = Math.max(0, Math.trunc(tick));
  const bucket = Math.floor(safeTick / 6);
  const noise = unit(profile.seed, bucket ^ Math.floor(safeTick / 37));
  if (profile.type === 'failing') {
    const burst = noise > 0.965 || (noise > 0.89 && bucket % 11 === 0);
    return burst ? Math.min(0.65, 0.34 + noise * 0.3) : 0;
  }
  const flutter = Math.sin(profile.phase + safeTick * 0.11) * 0.08 + (noise - 0.5) * 0.22;
  const blackout = noise < 0.028 ? -0.62 : noise > 0.975 ? 0.16 : 0;
  return Math.max(0.3, Math.min(1, profile.baseBrightness + flutter + blackout));
}
