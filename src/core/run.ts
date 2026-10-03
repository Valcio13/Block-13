import { deriveSeeds, type RunManifest } from './seedDerivation';

export type RunState = {
  floor: number;
  battery: number;
  curse: number;
  hp: number; // Health system
  score: number;
  status: 'playing' | 'won' | 'lost';
  floorsCompleted: number;
  timeStarted: number;
  seenStoryIds: string[]; // Track which stories have been shown this run

  // Blockchain manifest (optional - only present for blockchain runs)
  manifest?: RunManifest;

  // Legacy seed for backward compatibility with existing game code
  // Derived from manifest if present, otherwise random
  seed: number;
  /** Exact unsigned seed used by the Phaser-free simulation (decimal serialization). */
  canonicalSeed: string;
};

export const createRun = (manifest?: RunManifest): RunState => {
  // Generate legacy seed for existing game code
  // If manifest exists, derive from world entropy
  // Otherwise use random
  let canonicalSeed: bigint;

  if (manifest) {
    // Use canonical TX1 WORLD seed directly (32-byte keccak digest -> unsigned BigInt).
    canonicalSeed = deriveSeeds(manifest).world;
  } else {
    const bytes = new Uint8Array(8);
    globalThis.crypto?.getRandomValues(bytes);
    if (!globalThis.crypto?.getRandomValues) {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    canonicalSeed = 0n;
    for (const byte of bytes) canonicalSeed = (canonicalSeed << 8n) | BigInt(byte);
  }

  return {
    floor: 4, // Starting on Floor 4
    battery: 100,
    curse: 0,
    hp: 100, // Start with full health
    score: 0,
    status: 'playing',
    floorsCompleted: 0,
    timeStarted: Date.now(),
    seenStoryIds: [], // Empty at start of run
    manifest, // Store full manifest for seed derivation
    seed: Number(canonicalSeed & 0xffff_ffffn), // Legacy compatibility
    canonicalSeed: canonicalSeed.toString(10),
  };
};

export const completeFloor = (state: RunState): RunState => ({
  ...state,
  floor: state.floor - 1,
  floorsCompleted: state.floorsCompleted + 1,
  score: state.score + 100 * state.floor, // Higher floors worth more points
  curse: state.curse + 10, // Danger increases
  battery: Math.min(100, state.battery + 20), // Small battery restoration
  status: state.floor - 1 < 0 ? 'won' : 'playing', // Win after completing Block 13 (floor 0)
  // seenStoryIds persists across floors (don't reset)
  // manifest persists across floors (don't reset)
  // seed persists across floors (don't reset)
});
