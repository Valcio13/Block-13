# Block 13 TX1 Run Manifest - Final Specification

**Version**: 1.0.0
**Date**: 2026-09-09
**Status**: 🔒 **FROZEN**

---

## Overview

TX1 creates a **deterministic and auditable** run manifest that defines all initial conditions for gameplay. The manifest provides:

- **Multi-chain entropy** from BTC, Hemi, and Ethereum
- **Deterministic seed derivation** with domain separation
- **Replay compatibility** with the deterministic simulation engine
- **Replay inputs** for the current deterministic gameplay and result-commitment flow

**Important**: TX1 plus TX2 does not independently prove honest gameplay execution. TX2 stores the player's result and replay hashes for deterministic audit; no verifier is part of the current contest flow.

---

## Run Manifest Schema

### Solidity Contract Structure

```solidity
struct RunManifest {
    // Identity
    address player;              // Player's wallet address
    uint256 runId;              // Player's nonce for this run (per-player counter)

    // Game configuration
    GameMode gameMode;          // CLASSIC | SPEEDRUN | HARDCORE
    bytes32 gameVersion;        // keccak256 of version string (e.g., "0.1.0")
    bytes32 character;          // Character selection hash (future expansion)
    bytes32 rulesHash;          // Game rules/settings hash

    // Multi-chain entropy sources
    bytes32 btcBlockHash;       // Bitcoin block hash (WORLD seed source)
    bytes32 hemiBlockHash;      // Hemi block hash (WORLD seed source)
    bytes32 ethBlockHash;       // Ethereum block hash (ECONOMY seed source)
    bytes32 hemiTxHash;         // Existing Hemi tx hash (EVENT seed source)

    // Timing
    uint64 startedAt;           // Block timestamp when TX1 was mined
}
```

TX2 completion data is stored separately in `CompletedRun`; it is not part of
the TX1 manifest. The legacy contract's `submittedAt`, `score`, and `submitted`
fields have been removed from the current deployment ABI.

### TypeScript Interface

```typescript
export interface RunManifest {
  runId: bigint;               // Preserve Solidity uint256 without JS number precision loss
  player: string;              // Ethereum address (0x...)
  gameVersion: string;         // bytes32 as hex string
  rulesHash: string;           // bytes32 as hex string
  btcBlockHash: string;        // bytes32 as hex string
  hemiBlockHash: string;       // bytes32 as hex string
  ethBlockHash: string;        // bytes32 as hex string
  hemiTxHash: string;          // bytes32 as hex string
  startedAt: number;           // Unix timestamp (milliseconds)
}
```

---

## Entropy Source Selection

### 1. Bitcoin Block Hash

**Source**: Recent confirmed Bitcoin block
**Confirmation Requirement**: At least 1 confirmation (1 block deep)
**Usage**: WORLD seed (procedural generation)

**Selection Rule**:
```
Use the most recent Bitcoin block that is at least 1 confirmation old
at the time of TX1 submission.
```

**Rationale**: 1 confirmation provides sufficient immutability while keeping
latency low. Bitcoin's 10-minute block time makes deeper confirmations impractical.

---

### 2. Hemi Block Hash

**Source**: Recent confirmed Hemi block
**Confirmation Requirement**: At least 2 confirmations (2 blocks deep)
**Usage**: WORLD seed (procedural generation)

**Selection Rule**:
```
Use the Hemi block at height (currentBlockNumber - 2).
MUST NOT use the block that will contain TX1 itself.
```

**Implementation**:
```typescript
const latestBlock = await client.getBlockNumber();
const targetBlock = latestBlock - 2n;  // 2 confirmations
const block = await client.getBlock({ blockNumber: targetBlock });
return block.hash;
```

**Rationale**: 2 confirmations ensure the block is settled. Using (N-2) prevents
correlation with TX1's own block hash.

---

### 3. Ethereum Block Hash

**Source**: Recent confirmed Ethereum mainnet block
**Confirmation Requirement**: Latest block (considered final under PoS)
**Usage**: ECONOMY seed (loot, resources)

**Selection Rule**:
```
Use the most recent Ethereum mainnet block at time of TX1 submission.
```

**Implementation**:
```typescript
const block = await ethClient.getBlock({ blockTag: 'latest' });
return block.hash;
```

**Rationale**: Ethereum's PoS finality makes latest block safe to use.

---

### 4. Hemi Transaction Hash (Deterministic Selection)

**Source**: Existing confirmed Hemi transaction
**Confirmation Requirement**: At least 2 confirmations (same block as hemiBlockHash or earlier)
**Usage**: EVENT seed (scares, encounters, timing)

**⚠️ CRITICAL: Deterministic Selection Rule**

To ensure every implementation selects the **same** Hemi transaction, use this canonical rule:

```
1. Start with the confirmed Hemi block selected for hemiBlockHash (block N-2)
2. Look backwards through blocks N-2, N-3, N-4, ... N-11 (10 blocks maximum)
3. For each block, get all transactions sorted by transaction index (ascending)
4. Select the FIRST transaction that meets ALL criteria:
   a) Transaction is successful (status = 1)
   b) Transaction is NOT from the current player's address
   c) Transaction has non-zero gas used (not a simple transfer)
   d) Transaction index >= 0 (valid transaction)
5. Return the hash of this transaction
6. If NO suitable transaction found in 10 blocks, FAIL entropy initialization
```

**Pseudo-code**:

```typescript
async function selectCanonicalHemiTx(
  client: PublicClient,
  hemiBlockNumber: bigint,
  playerAddress: string
): Promise<`0x${string}`> {
  const MAX_LOOKBACK = 10;

  // Search backwards from hemiBlockNumber
  for (let offset = 0; offset < MAX_LOOKBACK; offset++) {
    const blockNumber = hemiBlockNumber - BigInt(offset);

    // Get block with full transaction objects
    const block = await client.getBlock({
      blockNumber,
      includeTransactions: true
    });

    if (!block.transactions || block.transactions.length === 0) {
      continue;
    }

    // Sort transactions by index (should already be sorted, but ensure it)
    const txs = [...block.transactions].sort((a, b) => {
      const aIndex = typeof a === 'object' ? a.transactionIndex : 0;
      const bIndex = typeof b === 'object' ? b.transactionIndex : 0;
      return aIndex - bIndex;
    });

    // Find first suitable transaction
    for (const tx of txs) {
      if (typeof tx !== 'object' || !tx.hash) continue;

      // Get transaction receipt to verify success
      const receipt = await client.getTransactionReceipt({ hash: tx.hash });

      // Check all criteria
      if (
        receipt.status === 'success' &&
        tx.from.toLowerCase() !== playerAddress.toLowerCase() &&
        receipt.gasUsed > 21000n  // More than simple transfer
      ) {
        return tx.hash;
      }
    }
  }

  // FAIL: No suitable transaction found
  throw new Error('ENTROPY_UNAVAILABLE: No suitable Hemi transaction found in last 10 blocks');
}
```

**Rationale**:
- **Deterministic**: Every implementation follows identical rules
- **External**: Not from player (prevents manipulation)
- **Meaningful**: Non-trivial transaction (has actual execution)
- **Fail-fast**: No fallback to block hash (preserves seed independence)

**Error Handling**:
```
If no suitable transaction found:
1. Display error to user: "Insufficient blockchain activity. Please retry in a few moments."
2. DO NOT fall back to hemiBlockHash
3. DO NOT generate a substitute value
4. User must retry TX1 when more transactions are available
```

---

## Canonical Seed Derivation

### Domain Separation

Three independent seeds are derived using domain-separated hashing:

```
BLOCK13_WORLD   - Procedural generation (BTC + Hemi blocks)
BLOCK13_ECONOMY - Loot and resources (ETH block)
BLOCK13_EVENT   - Scares and encounters (Hemi transaction)
```

### Exact Encoding Specification

**Input Format** (for each domain):

```
domain:entropy1:entropy2:...:player:runId:gameVersion:rulesHash
```

**Field Encoding**:

| Field | Type | Encoding | Example |
|-------|------|----------|---------|
| domain | string | UTF-8, uppercase | `BLOCK13_WORLD` |
| entropy | bytes32 | Lowercase hex with 0x | `0xabcd...` |
| player | address | Lowercase hex with 0x | `0x742d...` |
| runId | uint256 | Decimal string | `42` |
| gameVersion | bytes32 | Lowercase hex with 0x | `0x1234...` |
| rulesHash | bytes32 | Lowercase hex with 0x | `0xabcd...` |

**Separator**: Single colon `:` (ASCII 0x3A)

**Hash Function**: keccak256 (Ethereum-compatible)

### Exact Derivation Algorithm

```typescript
function deriveSeed(
  domain: string,
  entropy: string[],
  player: string,
  runId: bigint,
  gameVersion: string,
  rulesHash: string
): bigint {
  // 1. Normalize inputs
  const normalizedPlayer = player.toLowerCase();
  const normalizedEntropy = entropy.map(e => e.toLowerCase());
  const normalizedGameVersion = gameVersion.toLowerCase();
  const normalizedRulesHash = rulesHash.toLowerCase();

  // 2. Concatenate with colons
  const parts = [
    domain,  // Keep uppercase for domain
    ...normalizedEntropy,
    normalizedPlayer,
    runId.toString(),  // Decimal, no leading zeros
    normalizedGameVersion,
    normalizedRulesHash
  ];

  const data = parts.join(':');

  // 3. Hash with keccak256
  const hash = keccak256(toBytes(data));

  // 4. Convert to bigint
  return hexToBigInt(hash);
}
```

### Derivation Examples

#### WORLD Seed:

**Input**:
```
domain: BLOCK13_WORLD
btcBlockHash: 0x00000000000000000001a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3
hemiBlockHash: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
player: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
runId: 42
gameVersion: 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
rulesHash: 0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba
```

**Concatenated String**:
```
BLOCK13_WORLD:0x00000000000000000001a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3:0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:0x742d35cc6634c0532925a3b844bc9e7595f0beb:42:0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890:0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba
```

**keccak256 Hash**:
```
0x[resulting 64-character hex hash]
```

**Seed (bigint)**:
```
[resulting BigInt value]
```

#### ECONOMY Seed:

**Concatenated String**:
```
BLOCK13_ECONOMY:0x[ethBlockHash]:0x[player]:42:0x[gameVersion]:0x[rulesHash]
```

#### EVENT Seed:

**Concatenated String**:
```
BLOCK13_EVENT:0x[hemiTxHash]:0x[player]:42:0x[gameVersion]:0x[rulesHash]
```

---

## Replay Compatibility

### Required Fields for Deterministic Replay

The Run Manifest contains all data needed to recreate initial game state:

| Field | Usage in Replay |
|-------|----------------|
| **player** | Seed derivation (uniqueness) |
| **runId** | Seed derivation (uniqueness) |
| **gameVersion** | Seed derivation, rule validation |
| **rulesHash** | Seed derivation, settings validation |
| **btcBlockHash** | WORLD seed → floor layout, enemy placement |
| **hemiBlockHash** | WORLD seed → floor layout, enemy placement |
| **ethBlockHash** | ECONOMY seed → loot tables, resources |
| **hemiTxHash** | EVENT seed → scares, encounters, timing |

### NOT Required from TX1:

- **character**: Future expansion (currently unused)
- **gameMode**: Display only, doesn't affect gameplay
- **startedAt**: Timestamp for display/leaderboards only
- **completion result**: Stored separately by TX2, not part of TX1

### Deterministic replay flow:

```
1. Load RunManifest from blockchain (TX1)
2. Derive three seeds using canonical algorithm
3. Initialize PCG32 generators: world, economy, event
4. Load the canonical InputLogV2
5. Create SimulationEngine at 60Hz
6. Create InputReplayer with input log
7. Run game loop: for each tick, get input state, run fixed update
8. Derive FinalStateV1 and compare it with the player's TX2 commitment for audit
```

---

## Error Handling

### Entropy Initialization Failures

```typescript
enum EntropyError {
  NO_BTC_BLOCK = 'Unable to fetch Bitcoin block hash',
  NO_HEMI_BLOCK = 'Unable to fetch Hemi block hash',
  NO_ETH_BLOCK = 'Unable to fetch Ethereum block hash',
  NO_HEMI_TX = 'No suitable Hemi transaction found in last 10 blocks',
  VALIDATION_FAILED = 'Entropy validation failed (zero hash detected)'
}
```

**Handling**:
1. Display clear error message to user
2. Provide "Retry" button
3. DO NOT proceed with fallback entropy
4. DO NOT modify seed derivation algorithm
5. DO NOT use TX1's own block/tx hash

**User Message Example**:
```
"Unable to initialize game entropy. This can happen when blockchain
activity is low. Please wait a few moments and try again."
```

---

## Implementation Checklist

## Current implementation status (2026-10)

- TX1 `RunRegistry` manifest and start-run integration are implemented; this contract/schema remains frozen.
- Seed derivation uses `viem` Keccak-256 over the documented canonical text fields and retains `runId` as `bigint` in TypeScript.
- TX2 uses `completeRun` to store canonical result and replay hashes. It does not prove the game was honestly executed.
- InputLogV2 and FinalStateV1 are documented separately and implemented locally.
- An independent replay verifier, verifier signing/service, and honest-execution proof are not implemented or in the current contest flow.

See [README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md) for current project status. Earlier implementation checklists later in this historical specification describe past work and are not current status indicators.

---

## Testing Requirements

### Unit Tests:

```typescript
describe('Canonical Hemi TX Selection', () => {
  it('should select same tx given same block state', () => {
    // Test determinism
  });

  it('should exclude player transactions', () => {
    // Test external tx requirement
  });

  it('should select lowest index when multiple match', () => {
    // Test ordering
  });

  it('should fail when no suitable tx found', () => {
    // Test error handling
  });
});

describe('Seed Derivation', () => {
  it('should produce identical seeds for identical manifests', () => {
    // Test determinism
  });

  it('should produce different seeds for different manifests', () => {
    // Test uniqueness
  });

  it('should match reference implementation byte-for-byte', () => {
    // Test specification compliance
  });
});
```

### Integration Tests:

```typescript
describe('Full Entropy Flow', () => {
  it('should fetch and validate all entropy sources', () => {
    // Test complete flow
  });

  it('should handle retry when Hemi tx unavailable', () => {
    // Test error recovery
  });
});
```

---

## Version History

### v1.0.0 (2026-09-09) - Initial Frozen Specification

- Defined canonical Hemi tx selection rule
- Specified exact seed derivation algorithm
- Documented replay compatibility
- Removed fallback entropy mechanisms
- Changed terminology from "provably fair" to "deterministic and auditable"

---

## Appendices

### Appendix A: Reference Implementation

See `src/web3/entropyFetcher.ts` for canonical selection implementation.
See `src/core/seedDerivation.ts` for seed derivation implementation.

### Appendix B: Test Vectors

```typescript
const testManifest: RunManifest = {
  runId: 1n,
  player: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  gameVersion: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  rulesHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  btcBlockHash: '0x00000000000000000001a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3',
  hemiBlockHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  ethBlockHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  hemiTxHash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
  startedAt: 1704067200000,
};

// Expected seeds (verify with independent implementation):
// worldSeed: [expected bigint]
// economySeed: [expected bigint]
// eventSeed: [expected bigint]
```

---

**Status**: 🔒 **SPECIFICATION FROZEN** - Do not modify without version increment
