export type RunState = {
  seed: number;
  floor: number;
  battery: number;
  curse: number;
  score: number;
  status: 'playing' | 'won' | 'lost';
  floorsCompleted: number;
  timeStarted: number;
};

export const createRun = (seed: number): RunState => ({
  seed,
  floor: 3,
  battery: 100,
  curse: 0,
  score: 0,
  status: 'playing',
  floorsCompleted: 0,
  timeStarted: Date.now(),
});

export const completeFloor = (state: RunState): RunState => ({
  ...state,
  floor: state.floor - 1,
  floorsCompleted: state.floorsCompleted + 1,
  score: state.score + 100 * state.floor, // Higher floors worth more points
  curse: state.curse + 10, // Danger increases
  battery: Math.min(100, state.battery + 20), // Small battery restoration
  status: state.floor <= 1 ? 'won' : 'playing',
});
