import { PCG32 } from './pcg32';
import { initializeRNG, type RunManifest } from './seedDerivation';

/**
 * RNG Context
 * Holds three independent PCG32 generators for different game systems
 */
interface RNGContext {
  world: PCG32;    // Procedural generation (floors, layout, enemy placement)
  economy: PCG32;  // Loot tables, drops, resource distribution  
  event: PCG32;    // Scares, encounters, timing-based events
}

let currentRNG: RNGContext | null = null;

/**
 * Initialize RNG from run manifest
 * Must be called at the start of every run
 */
export function initRNG(manifest: RunManifest) {
  currentRNG = initializeRNG(manifest);
  console.log('[RNG] Initialized with multi-chain entropy');
}

/**
 * Initialize RNG for local-only run (no blockchain)
 * Uses simple random seeds
 */
export function initLocalRNG() {
  const timestamp = BigInt(Date.now());
  currentRNG = {
    world: new PCG32(timestamp),
    economy: new PCG32(timestamp + 1n),
    event: new PCG32(timestamp + 2n),
  };
  console.log('[RNG] Initialized local-only RNG');
}

/**
 * Get WORLD RNG (procedural generation)
 * Use for: floor layout, enemy placement, room generation
 */
export function getWorldRNG(): PCG32 {
  if (!currentRNG) {
    throw new Error('RNG not initialized - call initRNG() or initLocalRNG() first');
  }
  return currentRNG.world;
}

/**
 * Get ECONOMY RNG (loot and resources)
 * Use for: container contents, item drops, resource spawns
 */
export function getEconomyRNG(): PCG32 {
  if (!currentRNG) {
    throw new Error('RNG not initialized - call initRNG() or initLocalRNG() first');
  }
  return currentRNG.economy;
}

/**
 * Get EVENT RNG (scares and encounters)
 * Use for: jumpscare triggers, event timing, random encounters
 */
export function getEventRNG(): PCG32 {
  if (!currentRNG) {
    throw new Error('RNG not initialized - call initRNG() or initLocalRNG() first');
  }
  return currentRNG.event;
}

/**
 * Legacy SeededRng class for backward compatibility
 * Now wraps PCG32 WORLD generator
 */
export class SeededRng {
  private rng: PCG32;
  
  constructor(seed: number) {
    this.rng = new PCG32(BigInt(seed));
  }
  
  next() {
    return this.rng.nextFloat();
  }
  
  int(max: number) {
    return this.rng.nextRange(0, max - 1);
  }
}

