import { describe, expect, it } from 'vitest';
import { keccak256, toHex } from 'viem';
import {
  decodeFinalStateV1,
  encodeFinalStateV1,
  FINAL_STATE_V1_BYTES,
  finalStateV1FromTerminalState,
  hashFinalStateV1,
  type FinalStateV1,
} from '../src/core/finalStateV1';
import type { AuthoritativeState } from '../src/core/authoritativeSimulation';
import type { RunManifest } from '../src/core/seedDerivation';

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

const terminalState = (overrides: Partial<AuthoritativeState> = {}): AuthoritativeState => ({
  tick: 321,
  playerMoveRemainderX: 0,
  playerMoveRemainderY: 0,
  floor: 4,
  floorsCompleted: 0,
  x: 0,
  y: 0,
  hp: 0,
  battery: 12_800,
  curse: 0,
  score: 750,
  status: 'lost',
  flashlightOn: false,
  hasKey: false,
  searched: [],
  invulnerableUntilTick: 0,
  scareLockoutUntilTick: 0,
  movingWallClosed: false,
  movingWallTileX: 0,
  movingWallTileY: 0,
  movingWalls: [],
  lastMovingWallTick: 0,
  facingX: 0,
  facingY: 1,
  stalker: { state: 'dormant', x: 0, y: 0, targetX: 0, targetY: 0, ticksRemaining: 0, chaseStartTick: 0, lastChaseEndTick: 0, visible: false, moveRemainder: 0 },
  crawlers: [], watchers: [], ambushers: [], mimics: [],
  corruption: { lastTriggerTick: 0, effectId: 0, effectType: 0, intensityPermille: 0, durationTicks: 0 },
  boxScare: { lastTriggerTick: 0, lastType: 0, availableTypes: [] },
  scareEventId: 0,
  damageEventId: 1,
  lastDamage: 100,
  ...overrides,
});

const result = () => finalStateV1FromTerminalState(manifest, terminalState());

describe('FinalStateV1 canonical result', () => {
  it('encodes and hashes identical results identically, with an encode/decode round trip', () => {
    const a = result();
    const b = result();
    expect(encodeFinalStateV1(a)).toEqual(encodeFinalStateV1(b));
    expect(hashFinalStateV1(a)).toBe(hashFinalStateV1(b));
    expect(decodeFinalStateV1(encodeFinalStateV1(a))).toEqual(a);
    expect(encodeFinalStateV1(a)).toHaveLength(FINAL_STATE_V1_BYTES);
    expect(hashFinalStateV1(a)).toBe(keccak256(toHex(encodeFinalStateV1(a))));
  });

  it('commits every encoded field and binds results to the TX1 run identity', () => {
    const bytes = encodeFinalStateV1(result());
    const baseline = keccak256(toHex(bytes));
    // Byte spans by protocol field order. Mutating any committed field changes the digest.
    const spans: Array<[number, number]> = [[0, 2], [2, 34], [34, 54], [54, 86], [86, 118], [118, 122], [122, 123], [123, 127], [127, 128], [128, 129], [129, 131], [131, 133], [133, 135]];
    for (const [start, end] of spans) {
      const changed = bytes.slice();
      changed[start] ^= 1;
      expect(keccak256(toHex(changed)), `changed bytes ${start}..${end}`).not.toBe(baseline);
    }
    const otherRunManifest = { ...manifest, runId: manifest.runId + 1n };
    const otherRunResult = finalStateV1FromTerminalState(otherRunManifest, terminalState());
    expect(hashFinalStateV1(otherRunResult)).not.toBe(baseline);
  });

  it('rejects malformed, out-of-range, and incoherent terminal results', () => {
    expect(() => encodeFinalStateV1({ ...result(), runId: -1n })).toThrow();
    expect(() => encodeFinalStateV1({ ...result(), terminalTick: 0 })).toThrow();
    expect(() => encodeFinalStateV1({ ...result(), score: 0x1_0000_0000 })).toThrow();
    expect(() => encodeFinalStateV1({ ...result(), floorsCompleted: 1 })).toThrow();
    expect(() => encodeFinalStateV1({ ...result(), finalBattery: 25_601 })).toThrow();
    expect(() => decodeFinalStateV1(new Uint8Array(FINAL_STATE_V1_BYTES - 1))).toThrow();
    const invalidEnum = encodeFinalStateV1(result());
    invalidEnum[122] = 2;
    expect(() => decodeFinalStateV1(invalidEnum)).toThrow();
  });

  it('rejects nonterminal simulation states and encodes maximum uint256 run IDs exactly', () => {
    expect(() => finalStateV1FromTerminalState(manifest, terminalState({ status: 'playing' }))).toThrow();
    const maximumRunManifest = { ...manifest, runId: (1n << 256n) - 1n };
    const encoded = encodeFinalStateV1(finalStateV1FromTerminalState(maximumRunManifest, terminalState()));
    expect(decodeFinalStateV1(encoded).runId).toBe((1n << 256n) - 1n);
  });
});
