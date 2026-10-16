import { describe, expect, it } from 'vitest';
import { AuthoritativeSimulation } from '../src/core/authoritativeSimulation';
import { InputRecorder, InputReplayer, type InputState } from '../src/core/inputRecorder';
import type { RunState } from '../src/core/run';
import { keccak256, toHex } from 'viem';
import { ARCHIVE_GAME_VERSION, ARCHIVE_RULES_HASH, GAME_VERSION_BYTES32, PREVIOUS_GAME_VERSION, PREVIOUS_RULES_HASH, RULES_HASH } from '../src/web3/runIdentity';
import {
  createRunCheckpoint, hashAuthoritativeState, parseRunCheckpoint,
  serializeRunCheckpoint, validateRunRecovery,
} from '../src/core/runRecovery';

const neutral = (right = false): InputState => ({ left: false, right, up: false, down: false, flashlight: false, interact: false });
const runState: RunState = {
  floor: 4, battery: 100, curse: 0, hp: 100, score: 0, status: 'playing', floorsCompleted: 0,
  timeStarted: 1, seenStoryIds: [], seed: 1234, canonicalSeed: '1234',
};

function recordTo(ticks: number) {
  const simulation = new AuthoritativeSimulation(1234n);
  const recorder = new InputRecorder();
  for (let tick = 0; tick < ticks; tick++) {
    const input = neutral(tick < ticks - 1);
    simulation.step(input);
    recorder.recordTick(tick, input);
  }
  return { simulation, recorder };
}

describe('deterministic run recovery', () => {
  it('replays an arbitrary tick boundary and continues the canonical input log identically', () => {
    const original = recordTo(137);
    const bytes = original.recorder.encodeBinary();
    const checkpoint = createRunCheckpoint({
      runState,
      inputLog: bytes,
      terminalTick: original.simulation.state.tick,
      stateHash: hashAuthoritativeState(original.simulation.state),
      inputHash: keccak256(toHex(bytes)),
    });
    const payload = parseRunCheckpoint(serializeRunCheckpoint(checkpoint));
    const recovered = validateRunRecovery(payload);
    expect(recovered.state).toEqual(original.simulation.state);

    const continued = InputRecorder.fromBinary(bytes);
    const next = neutral(false);
    original.simulation.step(next);
    original.recorder.recordTick(137, next);
    continued.recordTick(137, next);
    expect(continued.encodeBinary()).toEqual(original.recorder.encodeBinary());
    expect(InputReplayer.fromBinary(continued.encodeBinary()).getStateAtTick(137)).toEqual(next);
    expect(recovered.state.tick).toBe(137);
  });

  it('rejects a corrupt log, unsupported schema, mismatched replay boundary, and old rules identity', () => {
    const original = recordTo(10);
    const bytes = original.recorder.encodeBinary();
    const checkpoint = createRunCheckpoint({
      runState, inputLog: bytes, terminalTick: 10,
      stateHash: hashAuthoritativeState(original.simulation.state), inputHash: keccak256(toHex(bytes)),
    });
    const corrupt = JSON.parse(serializeRunCheckpoint(checkpoint));
    corrupt.inputLogBase64 = `${corrupt.inputLogBase64.slice(0, -2)}AA`;
    expect(() => parseRunCheckpoint(JSON.stringify(corrupt))).toThrow(/integrity/);
    expect(() => parseRunCheckpoint(JSON.stringify({ ...checkpoint, schema: 99 }))).toThrow(/schema/);
    expect(() => validateRunRecovery({ ...parseRunCheckpoint(serializeRunCheckpoint(checkpoint)), terminalTick: 9 })).toThrow(/boundary/);
    const outdated = { ...checkpoint, runState: { ...runState, manifest: {
      runId: 1n, player: `0x${'11'.repeat(20)}`, gameVersion: `0x${Buffer.from('0.4.0').toString('hex').padEnd(64, '0')}`,
      rulesHash: `0x${'22'.repeat(32)}`, btcBlockHash: `0x${'33'.repeat(32)}`, hemiBlockHash: `0x${'44'.repeat(32)}`,
      ethBlockHash: `0x${'55'.repeat(32)}`, hemiTxHash: `0x${'66'.repeat(32)}`, startedAt: 1,
    } } };
    expect(() => parseRunCheckpoint(serializeRunCheckpoint(outdated))).toThrow(/incompatible gameplay rules/);
    const old041 = { ...checkpoint, runState: { ...runState, manifest: {
      runId: 2n, player: `0x${'11'.repeat(20)}`, gameVersion: `0x${Buffer.from('0.4.1').toString('hex').padEnd(64, '0')}`,
      rulesHash: `0x${'22'.repeat(32)}`, btcBlockHash: `0x${'33'.repeat(32)}`, hemiBlockHash: `0x${'44'.repeat(32)}`,
      ethBlockHash: `0x${'55'.repeat(32)}`, hemiTxHash: `0x${'66'.repeat(32)}`, startedAt: 1,
    } } };
    expect(() => parseRunCheckpoint(serializeRunCheckpoint(old041))).toThrow(/incompatible gameplay rules/);
    expect(GAME_VERSION_BYTES32).not.toBe(old041.runState.manifest.gameVersion);
    expect(RULES_HASH).not.toBe(old041.runState.manifest.rulesHash);
  });

  it('rejects an unfinished 0.4.2 checkpoint under the new objective rules', () => {
    const original = recordTo(10);
    const bytes = original.recorder.encodeBinary();
    const checkpoint = createRunCheckpoint({
      runState, inputLog: bytes, terminalTick: 10,
      stateHash: hashAuthoritativeState(original.simulation.state), inputHash: keccak256(toHex(bytes)),
    });
    const oldRules = {
      ...checkpoint,
      runState: { ...runState, manifest: {
        runId: 3n, player: `0x${'11'.repeat(20)}`,
        gameVersion: `0x${Buffer.from(PREVIOUS_GAME_VERSION).toString('hex').padEnd(64, '0')}`,
        rulesHash: PREVIOUS_RULES_HASH, btcBlockHash: `0x${'33'.repeat(32)}`,
        hemiBlockHash: `0x${'44'.repeat(32)}`, ethBlockHash: `0x${'55'.repeat(32)}`,
        hemiTxHash: `0x${'66'.repeat(32)}`, startedAt: 1,
      } },
    };
    expect(() => parseRunCheckpoint(serializeRunCheckpoint(oldRules))).toThrow(/incompatible gameplay rules/);
    expect(PREVIOUS_GAME_VERSION).toBe('0.4.2');
    expect(PREVIOUS_RULES_HASH).not.toBe(RULES_HASH);
  });

  it('rejects unfinished 0.5.0 checkpoints rather than replaying them under puzzle progression', () => {
    const original = recordTo(10);
    const bytes = original.recorder.encodeBinary();
    const checkpoint = createRunCheckpoint({
      runState, inputLog: bytes, terminalTick: 10,
      stateHash: hashAuthoritativeState(original.simulation.state), inputHash: keccak256(toHex(bytes)),
    });
    const archivedRules = {
      ...checkpoint,
      runState: { ...runState, manifest: {
        runId: 4n, player: `0x${'11'.repeat(20)}`,
        gameVersion: `0x${Buffer.from(ARCHIVE_GAME_VERSION).toString('hex').padEnd(64, '0')}`,
        rulesHash: ARCHIVE_RULES_HASH, btcBlockHash: `0x${'33'.repeat(32)}`,
        hemiBlockHash: `0x${'44'.repeat(32)}`, ethBlockHash: `0x${'55'.repeat(32)}`,
        hemiTxHash: `0x${'66'.repeat(32)}`, startedAt: 1,
      } },
    };
    expect(() => parseRunCheckpoint(serializeRunCheckpoint(archivedRules))).toThrow(/incompatible gameplay rules/);
    expect(ARCHIVE_GAME_VERSION).toBe('0.5.0');
    expect(ARCHIVE_RULES_HASH).not.toBe(RULES_HASH);
  });

});
