import { describe, expect, it } from 'vitest';
import { ConfirmedRunCountdownGate, countdownLabel, emptyRunPreparationStages, RUN_PREPARATION_STAGES, updateRunPreparationStage } from '../src/game/runPreparation';

describe('onchain run preparation presentation', () => {
  it('exposes only actual asynchronous preparation stages and changes only reported stages', () => {
    let stages = emptyRunPreparationStages();
    expect(RUN_PREPARATION_STAGES.map(stage => stage.id)).toEqual([
      'hemi-reference', 'bitcoin-reference', 'ethereum-reference', 'hemi-transaction',
      'wallet', 'confirmation', 'seed-manifest', 'game',
    ]);
    stages = updateRunPreparationStage(stages, 'bitcoin-reference', 'active');
    expect(stages['bitcoin-reference']).toBe('active');
    expect(stages['ethereum-reference']).toBe('pending');
    stages = updateRunPreparationStage(stages, 'bitcoin-reference', 'failed');
    expect(stages['bitcoin-reference']).toBe('failed');
  });

  it('shows only the requested three-second countdown labels', () => {
    expect([3, 2, 1].map(countdownLabel)).toEqual(['3', '2', '1']);
    expect(countdownLabel(0)).toBeNull();
    expect(countdownLabel(4)).toBeNull();
  });

  it('arms one countdown only after confirmed TX1 and successful run initialization', () => {
    const gate = new ConfirmedRunCountdownGate();
    expect(gate.begin(false, true)).toBe(false);
    expect(gate.begin(true, false)).toBe(false);
    expect(gate.begin(true, true)).toBe(true);
    expect(gate.begin(true, true)).toBe(false);
    gate.reset(); // cancellation/retry has a fresh attempt token
    expect(gate.begin(false, true)).toBe(false);
  });
});
