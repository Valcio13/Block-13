/**
 * Block 13 Seed Derivation - CANONICAL SPECIFICATION
 *
 * Derives independent deterministic seeds from multi-chain entropy sources
 * using domain separation to ensure different RNG systems don't correlate.
 *
 * Architecture:
 * - WORLD seed: BTC block hash + Hemi block hash (procedural generation)
 * - ECONOMY seed: Ethereum block hash (loot, drops, resources)
 * - EVENT seed: Existing Hemi tx hash (scares, encounters, timing)
 *
 * Each seed includes: player, runId, gameVersion, rulesHash for uniqueness
 *
 * IMPORTANT: This implementation must produce IDENTICAL seeds to any other
 * implementation given the same RunManifest. The encoding specification is
 * documented in TX1_RUN_MANIFEST_SPEC.md
 */

import { keccak256, toBytes, type Hex } from 'viem';
import { PCG32, hexToBigInt } from './pcg32';

/**
 * Domain separation prefixes (prevent cross-contamination)
 */
export const DOMAIN_WORLD = 'BLOCK13_WORLD';
export const DOMAIN_ECONOMY = 'BLOCK13_ECONOMY';
export const DOMAIN_EVENT = 'BLOCK13_EVENT';

/**
 * Run manifest from blockchain (TX1)
 */
export interface RunManifest {
  runId: bigint;
  player: string;       // Ethereum address (0x...)
  gameVersion: string;  // bytes32 as hex string (0x...)
  rulesHash: string;    // bytes32 as hex string (0x...)
  btcBlockHash: string; // bytes32 as hex string (0x...)
  hemiBlockHash: string; // bytes32 as hex string (0x...)
  ethBlockHash: string; // bytes32 as hex string (0x...)
  hemiTxHash: string;   // bytes32 as hex string (0x...)
  startedAt: number;    // Unix timestamp (milliseconds) - for display only
}

/**
 * Derived seeds for independent RNG systems
 */
export interface DerivedSeeds {
  world: bigint;      // Procedural generation (floors, layout, enemy placement)
  economy: bigint;    // Loot tables, drops, resource distribution
  event: bigint;      // Scares, encounters, timing-based events
}

/**
 * Derive domain-separated seed using canonical encoding
 *
 * Encoding specification:
 * - Format: domain:entropy1:entropy2:...:player:runId:gameVersion:rulesHash
 * - Separator: single colon ':' (ASCII 0x3A)
 * - domain: UTF-8, UPPERCASE (e.g., 'BLOCK13_WORLD')
 * - entropy: lowercase hex with 0x prefix
 * - player: lowercase hex with 0x prefix
 * - runId: decimal string, no leading zeros
 * - gameVersion: lowercase hex with 0x prefix
 * - rulesHash: lowercase hex with 0x prefix
 * - Hash function: keccak256 (Ethereum-compatible)
 *
 * @param domain - Domain separation string (e.g., 'BLOCK13_WORLD')
 * @param entropy - Array of entropy sources (block/tx hashes)
 * @param player - Player address
 * @param runId - Run ID (nonce)
 * @param gameVersion - Game version hash
 * @param rulesHash - Game rules hash
 * @returns Deterministic seed as bigin
 */
function deriveSeed(
  domain: string,
  entropy: string[],
  player: string,
  runId: bigint,
  gameVersion: string,
  rulesHash: string
): bigint {
  // Normalize all inputs to lowercase (except domain which stays uppercase)
  const normalizedPlayer = player.toLowerCase();
  const normalizedEntropy = entropy.map(e => e.toLowerCase());
  const normalizedGameVersion = gameVersion.toLowerCase();
  const normalizedRulesHash = rulesHash.toLowerCase();

  // Concatenate with colons as separator
  const parts = [
    domain,  // Keep uppercase for domain separation
    ...normalizedEntropy,
    normalizedPlayer,
    runId.toString(),  // Decimal string, no leading zeros
    normalizedGameVersion,
    normalizedRulesHash
  ];

  const data = parts.join(':');

  // Hash with keccak256 (Ethereum-compatible)
  const hash = keccak256(toBytes(data));

  // Convert to bigint for PCG32
  return hexToBigInt(hash);
}

/**
 * Derive all three independent seeds from run manifes
 *
 * This is the canonical seed derivation that must be reproduced identically
 * by any independent implementation (e.g., off-chain verifiers).
 */
export function deriveSeeds(manifest: RunManifest): DerivedSeeds {
  const { runId, player, gameVersion, rulesHash, btcBlockHash, hemiBlockHash, ethBlockHash, hemiTxHash } = manifest;

  // Validate all entropy sources are non-zero
  const zeroHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
  if (
    btcBlockHash === zeroHash ||
    hemiBlockHash === zeroHash ||
    ethBlockHash === zeroHash ||
    hemiTxHash === zeroHash
  ) {
    throw new Error('Invalid manifest: entropy source cannot be zero hash');
  }

  // WORLD seed: BTC + Hemi block hashes (most critical for fairness)
  const worldSeed = deriveSeed(
    DOMAIN_WORLD,
    [btcBlockHash, hemiBlockHash],
    player,
    runId,
    gameVersion,
    rulesHash
  );

  // ECONOMY seed: Ethereum block hash
  const economySeed = deriveSeed(
    DOMAIN_ECONOMY,
    [ethBlockHash],
    player,
    runId,
    gameVersion,
    rulesHash
  );

  // EVENT seed: Existing Hemi transaction hash
  const eventSeed = deriveSeed(
    DOMAIN_EVENT,
    [hemiTxHash],
    player,
    runId,
    gameVersion,
    rulesHash
  );

  return {
    world: worldSeed,
    economy: economySeed,
    event: eventSeed
  };
}

/**
 * Create PCG32 generators from derived seeds
 */
export function createRNGGenerators(seeds: DerivedSeeds) {
  return {
    world: new PCG32(seeds.world),
    economy: new PCG32(seeds.economy),
    event: new PCG32(seeds.event)
  };
}

/**
 * All-in-one: derive seeds and create RNG generators
 */
export function initializeRNG(manifest: RunManifest) {
  const seeds = deriveSeeds(manifest);
  return createRNGGenerators(seeds);
}
