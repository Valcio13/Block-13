import { keccak256, toHex } from 'viem';
import type { RunState } from './run';
import { deriveSeeds, type RunManifest } from './seedDerivation';
import { RULES_HASH, GAME_VERSION_BYTES32 } from '../web3/runIdentity';
import { AuthoritativeSimulation, FIXED_SCALE, type AuthoritativeState } from './authoritativeSimulation';
import { InputRecorder, InputReplayer, type InputEvent } from './inputRecorder';
import { encodeFinalStateV1, finalStateV1FromSimulation } from './finalStateV1';

export const RUN_RECOVERY_STORAGE_KEY = 'block13:active-run:v1';
export const RUN_RECOVERY_SCHEMA = 1;

export interface RunCheckpoint {
  schema: 1;
  runState: RunState;
  inputLogBase64: string;
  terminalTick: number;
  stateHash: `0x${string}`;
  inputHash: `0x${string}`;
  savedAt: number;
}

export interface RunRecoveryPayload {
  runState: RunState;
  inputLog: Uint8Array;
  terminalTick: number;
  stateHash: `0x${string}`;
  inputHash: `0x${string}`;
}

export interface ValidatedRunRecovery extends RunRecoveryPayload {
  state: AuthoritativeState;
  inputLogEvents: InputEvent[];
  finalStateBytes?: Uint8Array;
}

export const hashAuthoritativeState = (state: unknown): `0x${string}` =>
  keccak256(toHex(new TextEncoder().encode(JSON.stringify(state))));

export const encodeBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
};

export const decodeBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
};

export function createRunCheckpoint(payload: RunRecoveryPayload): RunCheckpoint {
  if (!Number.isSafeInteger(payload.terminalTick) || payload.terminalTick < 0 || payload.terminalTick > 0xffffffff) {
    throw new RangeError('Recovery terminal tick must fit uint32');
  }
  return {
    schema: RUN_RECOVERY_SCHEMA,
    runState: payload.runState,
    inputLogBase64: encodeBase64(payload.inputLog),
    terminalTick: payload.terminalTick,
    stateHash: payload.stateHash,
    inputHash: payload.inputHash,
    savedAt: Date.now(),
  };
}

const validManifest = (value: unknown): value is RunManifest => {
  if (!value || typeof value !== 'object') return false;
  const manifest = value as Partial<RunManifest>;
  return typeof manifest.runId === 'bigint'
    && typeof manifest.player === 'string'
    && typeof manifest.gameVersion === 'string'
    && typeof manifest.rulesHash === 'string'
    && typeof manifest.btcBlockHash === 'string'
    && typeof manifest.hemiBlockHash === 'string'
    && typeof manifest.ethBlockHash === 'string'
    && typeof manifest.hemiTxHash === 'string';
};

export function parseRunCheckpoint(json: string): RunRecoveryPayload {
  const parsed = JSON.parse(json, (_key, value) =>
    value && typeof value === 'object' && typeof value.__block13Uint256 === 'string'
      ? BigInt(value.__block13Uint256)
      : value,
  ) as Partial<RunCheckpoint>;
  if (parsed.schema !== RUN_RECOVERY_SCHEMA) throw new Error('Saved run uses an unsupported recovery schema.');
  const run = parsed.runState;
  if (!run || run.status !== 'playing' || !Number.isSafeInteger(run.floor)
    || typeof run.canonicalSeed !== 'string' || !/^\d+$/.test(run.canonicalSeed)
    || (run.manifest !== undefined && !validManifest(run.manifest))) {
    throw new Error('Saved run identity or initial state is invalid.');
  }
  if (run.manifest && (run.manifest.gameVersion.toLowerCase() !== GAME_VERSION_BYTES32
    || run.manifest.rulesHash.toLowerCase() !== RULES_HASH)) {
    throw new Error('Saved Hemi run uses older or incompatible gameplay rules and cannot be resumed safely.');
  }
  if (typeof parsed.inputLogBase64 !== 'string' || !Number.isSafeInteger(parsed.terminalTick)
    || (parsed.terminalTick as number) < 0 || typeof parsed.stateHash !== 'string'
    || typeof parsed.inputHash !== 'string') {
    throw new Error('Saved run checkpoint is incomplete or corrupt.');
  }
  const inputLog = decodeBase64(parsed.inputLogBase64);
  if (keccak256(toHex(inputLog)).toLowerCase() !== parsed.inputHash.toLowerCase()) {
    throw new Error('Saved run input log failed its integrity check.');
  }
  return {
    runState: run,
    inputLog,
    terminalTick: parsed.terminalTick as number,
    stateHash: parsed.stateHash as `0x${string}`,
    inputHash: parsed.inputHash as `0x${string}`,
  };
}

export function validateRunRecovery(payload: RunRecoveryPayload): ValidatedRunRecovery {
  const decodedEvents = InputRecorder.decodeBinary(payload.inputLog) as InputEvent[] & { terminalTick?: number };
  if (decodedEvents.terminalTick !== payload.terminalTick) throw new Error('Saved replay boundary does not match the checkpoint.');
  let previousTick = -1;
  for (const event of decodedEvents) {
    if (event.tick < previousTick || event.tick >= payload.terminalTick) throw new Error('Saved input log is not canonically ordered within its checkpoint.');
    previousTick = event.tick;
  }
  if (payload.runState.manifest) {
    const derivedSeed = deriveSeeds(payload.runState.manifest).world.toString(10);
    if (derivedSeed !== payload.runState.canonicalSeed) throw new Error('Saved run seed does not match its original manifest.');
  }
  const events = InputReplayer.fromBinary(payload.inputLog);
  const simulation = new AuthoritativeSimulation(BigInt(payload.runState.canonicalSeed), {
    floor: payload.runState.floor,
    hp: payload.runState.hp,
    battery: Math.round(payload.runState.battery * FIXED_SCALE),
    curse: Math.round(payload.runState.curse * FIXED_SCALE),
    score: payload.runState.score,
    floorsCompleted: payload.runState.floorsCompleted,
  });
  for (let tick = 0; tick < payload.terminalTick; tick++) simulation.step(events.getStateAtTick(tick));
  const state = simulation.state;
  if (state.tick !== payload.terminalTick || hashAuthoritativeState(state) !== payload.stateHash) {
    throw new Error('Saved run state does not match its deterministic input replay. The run was stopped safely.');
  }
  const inputLogEvents = [] as InputEvent[];
  // The recorder decoder is also the canonical validator for event order, bounds, and encoding.
  inputLogEvents.push(...decodedEvents);
  const finalStateBytes = payload.runState.manifest && state.status !== 'playing'
    ? encodeFinalStateV1(finalStateV1FromSimulation(payload.runState.manifest, simulation))
    : undefined;
  return { ...payload, state, inputLogEvents, finalStateBytes };
}

export function serializeRunCheckpoint(checkpoint: RunCheckpoint): string {
  return JSON.stringify(checkpoint, (_key, value) =>
    typeof value === 'bigint' ? { __block13Uint256: value.toString(10) } : value,
  );
}
