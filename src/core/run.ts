export type RunState = {
  seed: number;
  floor: number;
  battery: number;
  curse: number;
  hp: number; // New health system
  score: number;
  status: 'playing' | 'won' | 'lost';
  floorsCompleted: number;
  timeStarted: number;
  seenStoryIds: string[]; // Track which stories have been shown this run
  nonce?: number; // Blockchain run ID
  address?: string; // Player wallet address
};

export const createRun = (seed: number, nonce?: number, address?: string): RunState => ({
  seed,
  floor: 4, // Now starting on Floor 4
  battery: 100,
  curse: 0,
  hp: 100, // Start with full health
  score: 0,
  status: 'playing',
  floorsCompleted: 0,
  timeStarted: Date.now(),
  seenStoryIds: [], // Empty at start of run
  nonce,
  address,
});

export const completeFloor = (state: RunState): RunState => ({
  ...state,
  floor: state.floor - 1,
  floorsCompleted: state.floorsCompleted + 1,
  score: state.score + 100 * state.floor, // Higher floors worth more points
  curse: state.curse + 10, // Danger increases
  battery: Math.min(100, state.battery + 20), // Small battery restoration
  status: state.floor - 1 < 0 ? 'won' : 'playing', // Win after completing Block 13 (floor 0)
  // seenStoryIds persists across floors (don't reset)
});

// Convert blockchain seed (bytes32) to number seed
export const seedFromBytes32 = (bytes32: string): number => {
  // Take first 8 bytes and convert to number
  const hex = bytes32.slice(2, 18); // Remove 0x and take 16 hex chars (8 bytes)
  return parseInt(hex, 16);
};

// Generate action hash for score submission
// This is a proof-of-action commitment that could be validated later
export const generateActionHash = (nonce: number, score: number): `0x${string}` => {
  // Browser-compatible hash using Web Crypto API
  // For now, create a deterministic hash from nonce + score + timestamp
  // In production, this could hash actual gameplay actions/state
  const data = `${nonce}:${score}:${Date.now()}`;
  
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
