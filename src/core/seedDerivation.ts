/**
 * Block 13 Seed Derivation
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
 */

import { PCG32, hexToBigInt } from './pcg32';

/**
 * Domain separation prefixes (prevent cross-contamination)
 */
const DOMAIN_WORLD = 'BLOCK13_WORLD';
const DOMAIN_ECONOMY = 'BLOCK13_ECONOMY';
const DOMAIN_EVENT = 'BLOCK13_EVENT';

/**
 * Run manifest from blockchain
 */
export interface RunManifest {
  runId: number;
  player: string;
  gameVersion: string; // hex string (bytes32)
  rulesHash: string;   // hex string (bytes32)
  btcBlockHash: string;
  hemiBlockHash: string;
  ethBlockHash: string;
  hemiTxHash: string;
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
 * Hash data using simple browser-compatible method
 * (In production, consider using keccak256 from viem for true compatibility with Solidity)
 */
function simpleHash(data: string): string {
  // Simple hash for determinism - for production use crypto library
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Pad to 64 hex chars (32 bytes)
  return '0x' + Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Derive domain-separated seed
 */
function deriveSeed(
  domain: string,
  entropy: string[],
  player: string,
  runId: number,
  gameVersion: string,
  rulesHash: string
): bigint {
  // Concatenate all inputs with domain separation
  const data = [
    domain,
    ...entropy,
    player.toLowerCase(),
    runId.toString(),
    gameVersion,
    rulesHash
  ].join(':');

  const hash = simpleHash(data);
  return hexToBigInt(hash);
}

/**
 * Derive all three independent seeds from run manifest
 */
export function deriveSeeds(manifest: RunManifest): DerivedSeeds {
  const { runId, player, gameVersion, rulesHash, btcBlockHash, hemiBlockHash, ethBlockHash, hemiTxHash } = manifest;

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
