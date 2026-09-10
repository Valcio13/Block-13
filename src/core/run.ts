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
  status: state.floor <= 1 ? 'won' : 'playing', // Win after completing Floor 1 (floor becomes 0)
  // seenStoryIds persists across floors (don't reset)
});

// Convert blockchain seed (bytes32) to number seed
export const seedFromBytes32 = (bytes32: string): number => {
  // Take first 8 bytes and convert to number
  const hex = bytes32.slice(2, 18); // Remove 0x and take 16 hex chars (8 bytes)
  return parseInt(hex, 16);
};

// Generate simple action hash for score submission
export const generateActionHash = (nonce: number, score: number): `0x${string}` => {
  // Simple hash: keccak256(abi.encodePacked(nonce, score, timestamp))
  // For now, use a placeholder - can be enhanced later
  const data = `${nonce}:${score}:${Date.now()}`;
  const hash = '0x' + Buffer.from(data).toString('hex').padEnd(64, '0');
  return hash.slice(0, 66) as `0x${string}`;
};
