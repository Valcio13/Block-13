import { keccak256, toHex } from 'viem';
import type { RunManifest } from './seedDerivation';
import type { AuthoritativeSimulation, AuthoritativeState } from './authoritativeSimulation';

/** Public verification result. Internal simulation fields are intentionally excluded. */
export interface FinalStateV1 {
  version: 1;
  runId: bigint;
  player: `0x${string}`;
  gameVersion: `0x${string}`;
  rulesHash: `0x${string}`;
  terminalTick: number;
  outcome: 'won' | 'lost';
  score: number;
  floorsCompleted: number;
  finalFloor: number;
  finalHp: number;
  finalBattery: number;
  finalCurse: number;
}

/**
 * Canonical wire layout, fixed at 135 bytes, all multi-byte values big-endian:
 * version:u16, runId:u256, player:20 bytes, gameVersion:bytes32,
 * rulesHash:bytes32, terminalTick:u32, outcome:u8 (0 won, 1 lost),
 * score:u32, floorsCompleted:u8, finalFloor:i8 two's-complement,
 * finalHp:u16, finalBattery:u16, finalCurse:u16.
 * Battery and curse are 1/256 percent units from AuthoritativeSimulation.
 */
export const FINAL_STATE_V1_BYTES = 135;
export const FINAL_STATE_V1_VERSION = 1;
export const FINAL_STATE_V1_MAX_PROGRESS = 5;
export const FINAL_STATE_V1_MAX_RESOURCE = 100 * 256;

const MAX_U32 = 0xffff_ffff;
const MAX_U16 = 0xffff;
const MAX_U256 = (1n << 256n) - 1n;
const HEX20 = /^0x[0-9a-fA-F]{40}$/;
const HEX32 = /^0x[0-9a-fA-F]{64}$/;

function integerInRange(value: number, min: number, max: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${field} must be an integer in [${min}, ${max}]`);
  }
}

function validateFinalState(value: FinalStateV1): void {
  if (value.version !== FINAL_STATE_V1_VERSION) throw new RangeError('unsupported FinalStateV1 version');
  if (typeof value.runId !== 'bigint' || value.runId < 0n || value.runId > MAX_U256) throw new RangeError('runId must be uint256');
  if (!HEX20.test(value.player)) throw new TypeError('player must be a 20-byte address');
  if (!HEX32.test(value.gameVersion)) throw new TypeError('gameVersion must be bytes32');
  if (!HEX32.test(value.rulesHash)) throw new TypeError('rulesHash must be bytes32');
  integerInRange(value.terminalTick, 1, MAX_U32, 'terminalTick');
  if (value.outcome !== 'won' && value.outcome !== 'lost') throw new TypeError('outcome must be won or lost');
  integerInRange(value.score, 0, MAX_U32, 'score');
  integerInRange(value.floorsCompleted, 0, FINAL_STATE_V1_MAX_PROGRESS, 'floorsCompleted');
  integerInRange(value.finalFloor, -1, 4, 'finalFloor');
  if (value.floorsCompleted !== 4 - value.finalFloor) throw new RangeError('finalFloor and floorsCompleted are inconsistent');
  if (value.outcome === 'won' && value.finalFloor !== -1) throw new RangeError('won outcome requires Outside progression');
  if (value.outcome === 'lost' && value.finalFloor < 0) throw new RangeError('lost outcome requires a floor from 0 through 4');
  integerInRange(value.finalHp, 0, MAX_U16, 'finalHp');
  integerInRange(value.finalBattery, 0, FINAL_STATE_V1_MAX_RESOURCE, 'finalBattery');
  integerInRange(value.finalCurse, 0, FINAL_STATE_V1_MAX_RESOURCE, 'finalCurse');
  if (value.outcome === 'won' && (value.finalHp === 0 || value.finalCurse >= FINAL_STATE_V1_MAX_RESOURCE)) {
    throw new RangeError('won outcome is inconsistent with terminal HP or curse');
  }
  if (value.outcome === 'lost' && value.finalHp !== 0 && value.finalCurse < FINAL_STATE_V1_MAX_RESOURCE) {
    throw new RangeError('lost outcome requires zero HP or maximum curse');
  }
}

/** Project result fields from the simulation; callers cannot supply a separate score. */
export function finalStateV1FromSimulation(manifest: RunManifest, simulation: AuthoritativeSimulation): FinalStateV1 {
  return finalStateV1FromTerminalState(manifest, simulation.state);
}

/** Used by verifiers/tests after replay; validates that the state is terminal. */
export function finalStateV1FromTerminalState(manifest: RunManifest, state: AuthoritativeState): FinalStateV1 {
  if (state.status === 'playing') throw new RangeError('FinalStateV1 requires a terminal simulation state');
  const runId = manifest.runId;
  const result: FinalStateV1 = {
    version: FINAL_STATE_V1_VERSION,
    runId,
    player: manifest.player.toLowerCase() as `0x${string}`,
    gameVersion: manifest.gameVersion.toLowerCase() as `0x${string}`,
    rulesHash: manifest.rulesHash.toLowerCase() as `0x${string}`,
    terminalTick: state.tick,
    outcome: state.status,
    score: state.score,
    floorsCompleted: state.floorsCompleted,
    finalFloor: state.floor,
    finalHp: state.hp,
    finalBattery: state.battery,
    finalCurse: state.curse,
  };
  validateFinalState(result);
  return result;
}

export function encodeFinalStateV1(value: FinalStateV1): Uint8Array {
  validateFinalState(value);
  const bytes = new Uint8Array(FINAL_STATE_V1_BYTES);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  view.setUint16(offset, value.version, false); offset += 2;
  let runId = value.runId;
  for (let i = 31; i >= 0; i--) { bytes[offset + i] = Number(runId & 0xffn); runId >>= 8n; }
  offset += 32;
  const writeHex = (hex: string) => { bytes.set(Uint8Array.from(hex.slice(2).match(/.{2}/g)!, pair => Number.parseInt(pair, 16)), offset); offset += hex.length / 2 - 1; };
  writeHex(value.player);
  writeHex(value.gameVersion);
  writeHex(value.rulesHash);
  view.setUint32(offset, value.terminalTick, false); offset += 4;
  view.setUint8(offset++, value.outcome === 'won' ? 0 : 1);
  view.setUint32(offset, value.score, false); offset += 4;
  view.setUint8(offset++, value.floorsCompleted);
  view.setInt8(offset++, value.finalFloor);
  view.setUint16(offset, value.finalHp, false); offset += 2;
  view.setUint16(offset, value.finalBattery, false); offset += 2;
  view.setUint16(offset, value.finalCurse, false);
  return bytes;
}

export function decodeFinalStateV1(bytes: Uint8Array): FinalStateV1 {
  if (!(bytes instanceof Uint8Array) || bytes.length !== FINAL_STATE_V1_BYTES) throw new RangeError(`FinalStateV1 must be exactly ${FINAL_STATE_V1_BYTES} bytes`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const version = view.getUint16(offset, false); offset += 2;
  if (version !== FINAL_STATE_V1_VERSION) throw new RangeError('unsupported FinalStateV1 version');
  let runId = 0n;
  for (let i = 0; i < 32; i++) runId = (runId << 8n) | BigInt(bytes[offset++]);
  const readHex = (length: number) => {
    let hex = '0x';
    for (let i = 0; i < length; i++) hex += bytes[offset++].toString(16).padStart(2, '0');
    return hex;
  };
  const player = readHex(20) as `0x${string}`;
  const gameVersion = readHex(32) as `0x${string}`;
  const rulesHash = readHex(32) as `0x${string}`;
  const terminalTick = view.getUint32(offset, false); offset += 4;
  const outcomeValue = view.getUint8(offset++);
  if (outcomeValue > 1) throw new RangeError('invalid FinalStateV1 outcome enum');
  const score = view.getUint32(offset, false); offset += 4;
  const floorsCompleted = view.getUint8(offset++);
  const finalFloor = view.getInt8(offset++);
  const finalHp = view.getUint16(offset, false); offset += 2;
  const finalBattery = view.getUint16(offset, false); offset += 2;
  const finalCurse = view.getUint16(offset, false);
  const value: FinalStateV1 = {
    version: 1, runId, player, gameVersion, rulesHash, terminalTick,
    outcome: outcomeValue === 0 ? 'won' : 'lost', score, floorsCompleted, finalFloor,
    finalHp, finalBattery, finalCurse,
  };
  validateFinalState(value);
  return value;
}

export function hashFinalStateV1(value: FinalStateV1): `0x${string}` {
  return keccak256(toHex(encodeFinalStateV1(value)));
}
