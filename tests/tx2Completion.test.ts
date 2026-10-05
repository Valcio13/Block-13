import { describe, expect, it, vi } from 'vitest';
import { keccak256, toHex } from 'viem';
import { encodeFinalStateV1, type FinalStateV1 } from '../src/core/finalStateV1';
import { AuthoritativeSimulation } from '../src/core/authoritativeSimulation';
import { finalStateV1FromSimulation } from '../src/core/finalStateV1';
import { InputRecorder } from '../src/core/inputRecorder';
import type { RunManifest } from '../src/core/seedDerivation';
import { prepareRunCompletion, submitRunCompletion } from '../src/web3/tx2Completion';

const manifest: RunManifest = {
  runId: (1n << 200n) + 15n,
  player: '0x1111111111111111111111111111111111111111',
  gameVersion: `0x${'22'.repeat(32)}`,
  rulesHash: `0x${'33'.repeat(32)}`,
  btcBlockHash: `0x${'44'.repeat(32)}`,
  hemiBlockHash: `0x${'55'.repeat(32)}`,
  ethBlockHash: `0x${'66'.repeat(32)}`,
  hemiTxHash: `0x${'77'.repeat(32)}`,
  startedAt: 0,
};
const finalState: FinalStateV1 = {
  version: 1, runId: manifest.runId, player: manifest.player as `0x${string}`,
  gameVersion: manifest.gameVersion as `0x${string}`, rulesHash: manifest.rulesHash as `0x${string}`,
  terminalTick: 321, outcome: 'lost', score: 750, floorsCompleted: 4, finalFloor: 0,
  finalHp: 0, finalBattery: 12_800, finalCurse: 0,
};
const inputRecorder = (terminalTick = 321) => { const recorder = new InputRecorder(); recorder.setTerminalTick(terminalTick); return recorder.encodeBinary(); };

describe('TX2 completion preparation and flow', () => {
  it('derives every completion argument and both hashes from canonical bytes', () => {
    const inputLogBytes = inputRecorder();
    const finalStateBytes = encodeFinalStateV1(finalState);
    const prepared = prepareRunCompletion(manifest, inputLogBytes, finalStateBytes);
    expect(prepared.args).toEqual({
      runId: manifest.runId,
      score: finalState.score,
      outcome: 1,
      terminalTick: finalState.terminalTick,
      inputHash: keccak256(toHex(inputLogBytes)),
      finalStateHash: keccak256(toHex(finalStateBytes)),
    });
    expect(prepared.finalState).toEqual(finalState);
    expect(prepared.finalState.terminalTick).toBe(321);
    expect(prepared.finalState.score).toBe(750);
    expect(prepared.finalState.floorsCompleted).toBe(4);
  });

  it('prepares a winning result with canonical outcome 0 and the same TX2 method arguments', () => {
    const won: FinalStateV1 = {
      ...finalState,
      terminalTick: 654,
      outcome: 'won',
      score: 4_321,
      floorsCompleted: 5,
      finalFloor: -1,
      finalHp: 23,
      finalBattery: 7_680,
      finalCurse: 99 * 256,
    };
    const inputLogBytes = inputRecorder(won.terminalTick);
    const finalStateBytes = encodeFinalStateV1(won);
    const prepared = prepareRunCompletion(manifest, inputLogBytes, finalStateBytes);
    expect(prepared.finalState).toEqual(won);
    expect(prepared.args).toEqual({
      runId: manifest.runId,
      score: won.score,
      outcome: 0,
      terminalTick: won.terminalTick,
      inputHash: keccak256(toHex(inputLogBytes)),
      finalStateHash: keccak256(toHex(finalStateBytes)),
    });
  });

  it('derives score, outcome, and terminal tick from AuthoritativeSimulation state', () => {
    const simulation = new AuthoritativeSimulation(99n, {
      tick: 321, status: 'lost', score: 750, floor: 0, floorsCompleted: 4,
      hp: 0, battery: 12_800, curse: 0,
    });
    const stateBytes = encodeFinalStateV1(finalStateV1FromSimulation(manifest, simulation));
    const prepared = prepareRunCompletion(manifest, inputRecorder(), stateBytes);
    expect(prepared.args.score).toBe(simulation.state.score);
    expect(prepared.args.outcome).toBe(1);
    expect(prepared.args.terminalTick).toBe(simulation.state.tick);
    expect(prepared.finalState.finalFloor).toBe(0);
    expect(prepared.finalState.floorsCompleted).toBe(4);
  });

  it('does not request TX2 for a local lost run', async () => {
    const submit = vi.fn();
    const lostLocalState = new AuthoritativeSimulation(101n, { status: 'lost', hp: 0, tick: 321 });
    expect(lostLocalState.state.status).toBe('lost');
    const result = await submitRunCompletion({ inputLogBytes: inputRecorder(), finalStateBytes: encodeFinalStateV1(finalState), submit, confirm: vi.fn() });
    expect(result).toEqual({ local: true });
    expect(submit).not.toHaveBeenCalled();
  });

  it('retains completion bytes after a failed request and supports retry through the same data', async () => {
    const inputLogBytes = inputRecorder();
    const finalStateBytes = encodeFinalStateV1(finalState);
    let attempts = 0;
    const submit = vi.fn(async () => { attempts++; if (attempts === 1) throw new Error('wallet rejected'); return '0xtx'; });
    await expect(submitRunCompletion({ manifest, inputLogBytes, finalStateBytes, submit, confirm: vi.fn() })).rejects.toThrow('wallet rejected');
    expect(finalStateBytes).toEqual(encodeFinalStateV1(finalState));
    const confirm = vi.fn();
    const completed = await submitRunCompletion({ manifest, inputLogBytes, finalStateBytes, submit, confirm });
    expect(completed).toMatchObject({ local: false, submission: '0xtx' });
    expect(confirm).toHaveBeenCalledWith('0xtx');
    expect(submit).toHaveBeenCalledTimes(2);
    await expect(submitRunCompletion({ manifest: { ...manifest, runId: manifest.runId + 1n }, inputLogBytes, finalStateBytes, submit, confirm: vi.fn() })).rejects.toThrow('runId');
  });

  it('rejects mismatched canonical run bindings and terminal ticks', () => {
    expect(() => prepareRunCompletion({ ...manifest, runId: manifest.runId + 1n }, inputRecorder(), encodeFinalStateV1(finalState))).toThrow('runId');
    const invalidLog = new InputRecorder(); invalidLog.setTerminalTick(320);
    expect(() => prepareRunCompletion(manifest, invalidLog.encodeBinary(), encodeFinalStateV1(finalState))).toThrow('terminal ticks');
  });
});
