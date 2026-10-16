import { describe, expect, it } from 'vitest';
import { encodeFunctionData, keccak256, toBytes, toHex } from 'viem';
import { deriveSeeds, type RunManifest } from '../src/core/seedDerivation';
import { finalStateV1FromTerminalState } from '../src/core/finalStateV1';
import type { AuthoritativeState } from '../src/core/authoritativeSimulation';
import { RUN_REGISTRY_ABI } from '../src/web3/config';
import { ARCHIVE_GAME_VERSION, ARCHIVE_RULES_HASH, ARCHIVE_RULES_IDENTIFIER, GAME_VERSION, GAME_VERSION_BYTES32, HISTORICAL_GAME_VERSION, HISTORICAL_RULES_HASH, HISTORICAL_RULES_IDENTIFIER, LEGACY_GAME_VERSION, LEGACY_RULES_HASH, LEGACY_RULES_IDENTIFIER, PREVIOUS_GAME_VERSION, PREVIOUS_RULES_HASH, PREVIOUS_RULES_IDENTIFIER, PROCEDURAL_PUZZLE_GAME_VERSION, PROCEDURAL_PUZZLE_RULES_HASH, PROCEDURAL_PUZZLE_RULES_IDENTIFIER, RULES_HASH, RULES_IDENTIFIER } from '../src/web3/runIdentity';

const manifest: RunManifest = {
  runId: 7n,
  player: '0x1111111111111111111111111111111111111111',
  gameVersion: GAME_VERSION_BYTES32,
  rulesHash: RULES_HASH,
  btcBlockHash: `0x${'11'.repeat(32)}`,
  hemiBlockHash: `0x${'22'.repeat(32)}`,
  ethBlockHash: `0x${'33'.repeat(32)}`,
  hemiTxHash: `0x${'44'.repeat(32)}`,
  startedAt: 0,
};

const terminalState = (): AuthoritativeState => ({
  tick: 1,
  playerMoveRemainderX: 0, playerMoveRemainderY: 0,
  floor: 4, floorsCompleted: 0, x: 0, y: 0, hp: 0, battery: 0, curse: 0, score: 0,
  status: 'lost', flashlightOn: false, hasKey: false, objectiveComplete: false, searched: [],
  invulnerableUntilTick: 0, scareLockoutUntilTick: 0, facingX: 0, facingY: 1,
  stalker: { state: 'dormant', x: 0, y: 0, targetX: 0, targetY: 0, ticksRemaining: 0, chaseStartTick: 0, lastChaseEndTick: 0, visible: false, moveRemainder: 0 },
  crawlers: [], watchers: [], ambushers: [], mimics: [],
  corruption: { lastTriggerTick: 0, effectId: 0, effectType: 0, intensityPermille: 0, durationTicks: 0 },
  boxScare: { lastTriggerTick: 0, lastType: 0, availableTypes: [] },
  scareEventId: 0, damageEventId: 1, lastDamage: 100,
});

describe('canonical TX1 rules identity', () => {
  it('hashes the exact current UTF-8 identifier to bytes32 and binds all identity paths to it', () => {
    expect(GAME_VERSION).toBe('0.6.3');
    expect(PREVIOUS_GAME_VERSION).toBe('0.4.2');
    expect(HISTORICAL_GAME_VERSION).toBe('0.4.1');
    expect(LEGACY_GAME_VERSION).toBe('0.4.0');
    expect(PROCEDURAL_PUZZLE_GAME_VERSION).toBe('0.6.0');
    expect(PROCEDURAL_PUZZLE_RULES_IDENTIFIER).toBe('floor13-procedural-puzzles-floor-progression-v1');
    expect(PROCEDURAL_PUZZLE_RULES_HASH).toBe(keccak256(toBytes(PROCEDURAL_PUZZLE_RULES_IDENTIFIER)));
    expect(RULES_IDENTIFIER).toBe('floor13-procedural-puzzles-floor-progression-v4-spaced-searchables');
    expect(PREVIOUS_RULES_IDENTIFIER).toBe('classic-maintenance-lockbox-v1-static-walls-balance-v2-stalker-mimic-v1');
    expect(PREVIOUS_RULES_HASH).toBe(keccak256(toBytes(PREVIOUS_RULES_IDENTIFIER)));
    expect(ARCHIVE_GAME_VERSION).toBe('0.5.0');
    expect(ARCHIVE_RULES_IDENTIFIER).toBe('floor13-archive-objectives-expanded-maps-rare-encounters-v1');
    expect(ARCHIVE_RULES_HASH).toBe(keccak256(toBytes(ARCHIVE_RULES_IDENTIFIER)));
    expect(LEGACY_RULES_IDENTIFIER).toBe('classic-static-walls-balance-v1-stalker-mimic-v1');
    expect(LEGACY_RULES_HASH).toBe(keccak256(toBytes(LEGACY_RULES_IDENTIFIER)));
    expect(HISTORICAL_RULES_IDENTIFIER).toBe('classic-static-walls-balance-v2-stalker-mimic-v1');
    expect(HISTORICAL_RULES_HASH).toBe(keccak256(toBytes(HISTORICAL_RULES_IDENTIFIER)));
    expect(RULES_HASH).toBe(keccak256(toBytes(RULES_IDENTIFIER)));
    expect(toBytes(RULES_HASH)).toHaveLength(32);
    expect(manifest.rulesHash).toBe(RULES_HASH);

    const tx1Data = encodeFunctionData({
      abi: RUN_REGISTRY_ABI,
      functionName: 'startRun',
      args: [0, manifest.gameVersion as `0x${string}`, `0x${Buffer.from('survivor').toString('hex').padEnd(64, '0')}`,
        manifest.rulesHash as `0x${string}`, manifest.btcBlockHash as `0x${string}`,
        manifest.hemiBlockHash as `0x${string}`, manifest.ethBlockHash as `0x${string}`,
        manifest.hemiTxHash as `0x${string}`],
    });
    expect(tx1Data.length).toBeGreaterThan(10);
    const rawIdentifierHex = toHex(toBytes(RULES_IDENTIFIER));
    expect(toBytes(RULES_IDENTIFIER).length).toBeGreaterThan(32);
    expect(() => encodeFunctionData({
      abi: RUN_REGISTRY_ABI,
      functionName: 'startRun',
      args: [0, manifest.gameVersion as `0x${string}`, `0x${Buffer.from('survivor').toString('hex').padEnd(64, '0')}`,
        rawIdentifierHex as `0x${string}`, manifest.btcBlockHash as `0x${string}`,
        manifest.hemiBlockHash as `0x${string}`, manifest.ethBlockHash as `0x${string}`,
        manifest.hemiTxHash as `0x${string}`],
    })).toThrow();

    const seeds = deriveSeeds(manifest);
    const seedsFromCanonicalHash = deriveSeeds({ ...manifest, rulesHash: keccak256(toBytes(RULES_IDENTIFIER)) });
    expect(seeds).toEqual(seedsFromCanonicalHash);
    expect(deriveSeeds({ ...manifest, rulesHash: rawIdentifierHex })).not.toEqual(seeds);

    const finalState = finalStateV1FromTerminalState(manifest, terminalState());
    expect(finalState.rulesHash).toBe(RULES_HASH);
    expect(deriveSeeds({ ...manifest, rulesHash: LEGACY_RULES_HASH })).not.toEqual(seeds);
  });
});
