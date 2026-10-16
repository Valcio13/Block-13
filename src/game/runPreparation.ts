/** Accurate player-facing stages for onchain run preparation. */
export const RUN_PREPARATION_STAGES = [
  { id: 'hemi-reference', label: 'Read confirmed Hemi block data' },
  { id: 'bitcoin-reference', label: 'Read Bitcoin block data' },
  { id: 'ethereum-reference', label: 'Read Ethereum block data' },
  { id: 'hemi-transaction', label: 'Find the canonical Hemi transaction' },
  { id: 'wallet', label: 'Confirm the run start in your wallet' },
  { id: 'confirmation', label: 'Wait for TX1 confirmation on Hemi' },
  { id: 'seed-manifest', label: 'Derive the run seed and prepare its manifest' },
  { id: 'game', label: 'Prepare Floor 4' },
] as const;

export type RunPreparationStageId = typeof RUN_PREPARATION_STAGES[number]['id'];
export type RunPreparationStageStatus = 'pending' | 'active' | 'completed' | 'failed';
export type RunPreparationStages = Record<RunPreparationStageId, RunPreparationStageStatus>;

export function emptyRunPreparationStages(): RunPreparationStages {
  return Object.fromEntries(RUN_PREPARATION_STAGES.map(({ id }) => [id, 'pending'])) as RunPreparationStages;
}

/** Terminal/active statuses change only when the real operation reports them. */
export function updateRunPreparationStage(
  current: RunPreparationStages,
  stage: RunPreparationStageId,
  status: RunPreparationStageStatus,
): RunPreparationStages {
  return { ...current, [stage]: status };
}

export function countdownLabel(seconds: number): string | null {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3) return null;
  return String(seconds);
}

/** One confirmed, initialized run can arm exactly one automatic countdown. */
export class ConfirmedRunCountdownGate {
  private started = false;

  begin(tx1Confirmed: boolean, runInitialized: boolean): boolean {
    if (this.started || !tx1Confirmed || !runInitialized) return false;
    this.started = true;
    return true;
  }

  reset() { this.started = false; }
}
