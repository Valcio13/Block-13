import type { RunManifest } from './seedDerivation';

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
};

export const createRun = (manifest?: RunManifest): RunState => {
  // Generate legacy seed for existing game code
  // If manifest exists, derive from world entropy
  // Otherwise use random
  let legacySeed: number;
  
  if (manifest) {
    // Convert first 8 bytes of BTC hash to number for legacy seed
    const hex = manifest.btcBlockHash.slice(2, 18); // Remove 0x, take 16 hex chars
    legacySeed = parseInt(hex, 16);
  } else {
    legacySeed = Math.floor(Math.random() * 0xFFFFFFFF);
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
    seed: legacySeed, // Legacy compatibility
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

// Generate action hash for score submission
// This is a proof-of-action commitment that could be validated later
export const generateActionHash = (runId: number, score: number): `0x${string}` => {
  // Browser-compatible hash using Web Crypto API
  // For now, create a deterministic hash from runId + score + timestamp
  // In production, this could hash actual gameplay actions/state
  const data = `${runId}:${score}:${Date.now()}`;
  
  // Simple browser-safe hash: use hex encoding + pad to 32 bytes
  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);
  
  // Convert to hex and pad to 64 chars (32 bytes)
  let hex = Array.from(encoded)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Pad or truncate to exactly 64 hex chars (32 bytes)
  hex = hex.padEnd(64, '0').slice(0, 64);
  
  return ('0x' + hex) as `0x${string}`;
};
