import { describe, expect, it } from 'vitest';
import { encodeFunctionData, keccak256, toBytes, toHex } from 'viem';
import { deriveSeeds, type RunManifest } from '../src/core/seedDerivation';
import { finalStateV1FromTerminalState } from '../src/core/finalStateV1';
import type { AuthoritativeState } from '../src/core/authoritativeSimulation';
import { RUN_REGISTRY_ABI } from '../src/web3/config';
import { RULES_HASH, RULES_IDENTIFIER } from '../src/web3/runIdentity';

const manifest: RunManifest = {
  runId: 7n,
  player: '0x1111111111111111111111111111111111111111',
  gameVersion: `0x${Buffer.from('0.4.0').toString('hex').padEnd(64, '0')}`,
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
  status: 'lost', flashlightOn: false, hasKey: false, searched: [],
  invulnerableUntilTick: 0, scareLockoutUntilTick: 0, facingX: 0, facingY: 1,
  stalker: { state: 'dormant', x: 0, y: 0, targetX: 0, targetY: 0, ticksRemaining: 0, chaseStartTick: 0, lastChaseEndTick: 0, visible: false, moveRemainder: 0 },
  crawlers: [], watchers: [], ambushers: [], mimics: [],
  corruption: { lastTriggerTick: 0, effectId: 0, effectType: 0, intensityPermille: 0, durationTicks: 0 },
  boxScare: { lastTriggerTick: 0, lastType: 0, availableTypes: [] },
  scareEventId: 0, damageEventId: 1, lastDamage: 100,
});

describe('canonical TX1 rules identity', () => {
  it('hashes the exact current UTF-8 identifier to bytes32 and binds all identity paths to it', () => {
    expect(RULES_IDENTIFIER).toBe('classic-static-walls-balance-v1-stalker-mimic-v1');
    expect(Buffer.from(RULES_IDENTIFIER, 'utf8')).toHaveLength(48);
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
    expect(rawIdentifierHex).toHaveLength(98);
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
  });
});
