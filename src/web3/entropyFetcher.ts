/**
 * Entropy Fetcher
 *
 * Fetches recent block hashes from BTC, Hemi, and Ethereum chains
 * to use as entropy sources for run manifest creation.
 *
 * CRITICAL: Implements canonical deterministic Hemi transaction selection
 * so that every implementation selects the same transaction given the same blockchain state.
 */

import { createPublicClient, http, type PublicClient } from 'viem';
import { mainnet } from 'viem/chains';
import { hemiTestnet } from './config';

/**
 * Entropy sources from multiple chains
 */
export interface EntropyBundle {
  btcBlockHash: `0x${string}`;
  hemiBlockHash: `0x${string}`;
  ethBlockHash: `0x${string}`;
  hemiTxHash: `0x${string}`;
}

/**
 * Entropy initialization errors
 */
export class EntropyError extends Error {
  constructor(
    message: string,
    public code: 'NO_BTC_BLOCK' | 'NO_HEMI_BLOCK' | 'NO_ETH_BLOCK' | 'NO_HEMI_TX' | 'VALIDATION_FAILED'
  ) {
    super(message);
    this.name = 'EntropyError';
  }
}

/**
 * Fetch recent Ethereum mainnet block hash
 */
async function fetchEthBlockHash(): Promise<`0x${string}`> {
  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http('https://eth.llamarpc.com'), // Public RPC
    });

    const block = await client.getBlock({ blockTag: 'latest' });

    if (!block.hash || block.hash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      throw new EntropyError('Invalid ETH block hash returned', 'NO_ETH_BLOCK');
    }

    return block.hash;
  } catch (error) {
    console.error('Failed to fetch ETH block hash:', error);
    throw new EntropyError('Unable to fetch Ethereum block hash', 'NO_ETH_BLOCK');
  }
}

/**
 * Fetch recent Hemi block hash (not the current tx's block)
 *
 * Uses block at height (N-2) where N is latest block number.
 * This ensures 2 confirmations and prevents correlation with TX1's own block.
 */
async function fetchHemiBlockHash(client: PublicClient): Promise<`0x${string}`> {
  try {
    const latestBlock = await client.getBlockNumber();
    // Get block that's 2 blocks old (2 confirmations)
    const targetBlock = latestBlock - 2n;

    if (targetBlock < 0n) {
      throw new EntropyError('Insufficient Hemi blocks for confirmation', 'NO_HEMI_BLOCK');
    }

    const block = await client.getBlock({ blockNumber: targetBlock });

    if (!block.hash || block.hash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      throw new EntropyError('Invalid Hemi block hash returned', 'NO_HEMI_BLOCK');
    }

    return block.hash;
  } catch (error) {
    console.error('Failed to fetch Hemi block hash:', error);
    if (error instanceof EntropyError) throw error;
    throw new EntropyError('Unable to fetch Hemi block hash', 'NO_HEMI_BLOCK');
  }
}

/**
 * CANONICAL Hemi Transaction Selection
 *
 * Implements deterministic selection rule so every implementation selects
 * the SAME transaction given the same blockchain state.
 *
 * Selection Algorithm:
 * 1. Start with the confirmed Hemi block (same as hemiBlockHash source)
 * 2. Look backwards through blocks N, N-1, N-2, ... N-9 (10 blocks max)
 * 3. For each block, get all transactions sorted by transaction index (ascending)
 * 4. Select the FIRST transaction that meets ALL criteria:
 *    a) Transaction is successful (status = 'success')
 *    b) Transaction is NOT from the current player's address
 *    c) Transaction used more than 21000 gas (not a simple transfer)
 * 5. Return the hash of this transaction
 * 6. If NO suitable transaction found in 10 blocks, throw EntropyError
 *
 * CRITICAL: Do NOT fall back to block hash. This preserves seed independence.
 *
 * @param client - Viem public client connected to Hemi
 * @param hemiBlockNumber - The block number used for hemiBlockHash (N-2 from latest)
 * @param userAddress - Current user's address (to exclude their own transactions)
 */
async function selectCanonicalHemiTx(
  client: PublicClient,
  hemiBlockNumber: bigint,
  userAddress: string
): Promise<`0x${string}`> {
  const MAX_LOOKBACK = 10;
  const normalizedUserAddress = userAddress.toLowerCase();

  console.log(`[EntropyFetcher] Searching for canonical Hemi tx starting from block ${hemiBlockNumber}...`);

  // Search backwards from hemiBlockNumber
  for (let offset = 0; offset < MAX_LOOKBACK; offset++) {
    const blockNumber = hemiBlockNumber - BigInt(offset);

    if (blockNumber < 0n) {
      break; // Reached genesis
    }

    try {
      // Get block with full transaction objects
      const block = await client.getBlock({
        blockNumber,
        includeTransactions: true
      });

      if (!block.transactions || block.transactions.length === 0) {
        continue; // Empty block, try nex
      }

      // Ensure transactions are sorted by index (should already be, but guarantee it)
      const txs = [...block.transactions].sort((a, b) => {
        if (typeof a !== 'object' || typeof b !== 'object') return 0;
        const aIndex = a.transactionIndex || 0;
        const bIndex = b.transactionIndex || 0;
        return aIndex - bIndex;
      });

      // Find first suitable transaction
      for (const tx of txs) {
        if (typeof tx !== 'object' || !tx.hash) continue;

        try {
          // Get transaction receipt to verify success and gas usage
          const receipt = await client.getTransactionReceipt({ hash: tx.hash });

          // Check all criteria
          const isSuccessful = receipt.status === 'success';
          const isExternal = tx.from.toLowerCase() !== normalizedUserAddress;
          const isNonTrivial = receipt.gasUsed > 21000n; // More than simple transfer

          if (isSuccessful && isExternal && isNonTrivial) {
            console.log(`[EntropyFetcher] Selected canonical Hemi tx: ${tx.hash} from block ${blockNumber}`);
            return tx.hash;
          }
        } catch (receiptError) {
          // Skip this transaction if receipt fetch fails
          continue;
        }
      }
    } catch (blockError) {
      console.warn(`[EntropyFetcher] Failed to fetch block ${blockNumber}:`, blockError);
      continue; // Try next block
    }
  }

  // No suitable transaction found in lookback window
  throw new EntropyError(
    `No suitable Hemi transaction found in last ${MAX_LOOKBACK} blocks. ` +
    'This can happen when blockchain activity is low. Please retry in a few moments.',
    'NO_HEMI_TX'
  );
}

/**
 * Fetch Bitcoin block hash
 *
 * Uses blockstream.info API for Bitcoin mainnet.
 * In production, consider using:
 * - Hemi Bitcoin Kit integration
 * - Your own Bitcoin node RPC
 * - Multiple API fallbacks for reliability
 *
 * Confirmation requirement: At least 1 confirmation (1 block deep)
 */
async function fetchBtcBlockHash(): Promise<`0x${string}`> {
  try {
    // Get current tip heigh
    const response = await fetch('https://blockstream.info/api/blocks/tip/height');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const height = await response.json();

    // Get block at height-1 (1 confirmation)
    const confirmedHeight = height - 1;
    const blockResponse = await fetch(`https://blockstream.info/api/block-height/${confirmedHeight}`);
    if (!blockResponse.ok) {
      throw new Error(`HTTP ${blockResponse.status}`);
    }

    const blockHash = await blockResponse.text();

    if (!blockHash || blockHash.length !== 64) {
      throw new Error('Invalid block hash format');
    }

    // Convert Bitcoin hash to 0x-prefixed hex
    // Note: Bitcoin displays hashes in reverse byte order, but we use as-is for consistency
    return ('0x' + blockHash) as `0x${string}`;
  } catch (error) {
    console.error('Failed to fetch BTC block hash:', error);
    throw new EntropyError(
      'Unable to fetch Bitcoin block hash. Please check your internet connection and retry.',
      'NO_BTC_BLOCK'
    );
  }
}

/**
 * Fetch all entropy sources with canonical selection rules
 *
 * @param hemiClient - Viem public client connected to Hemi
 * @param userAddress - Current user's address (to exclude their own transactions)
 * @throws EntropyError if any entropy source cannot be obtained
 */
export async function fetchEntropyBundle(
  hemiClient: PublicClient,
  userAddress: string
): Promise<EntropyBundle> {
  console.log('[EntropyFetcher] Fetching entropy from multiple chains...');

  try {
    // Fetch Hemi block hash first (needed for tx selection)
    const hemiBlockHash = await fetchHemiBlockHash(hemiClient);

    // Parse block number from the block we just fetched
    const latestBlock = await hemiClient.getBlockNumber();
    const hemiBlockNumber = latestBlock - 2n; // Same as fetchHemiBlockHash logic

    // Fetch all other sources in parallel
    const [btcBlockHash, ethBlockHash, hemiTxHash] = await Promise.all([
      fetchBtcBlockHash(),
      fetchEthBlockHash(),
      selectCanonicalHemiTx(hemiClient, hemiBlockNumber, userAddress),
    ]);

    const bundle = {
      btcBlockHash,
      hemiBlockHash,
      ethBlockHash,
      hemiTxHash,
    };

    console.log('[EntropyFetcher] Entropy bundle collected:', {
      btcBlockHash: btcBlockHash.slice(0, 10) + '...',
      hemiBlockHash: hemiBlockHash.slice(0, 10) + '...',
      ethBlockHash: ethBlockHash.slice(0, 10) + '...',
      hemiTxHash: hemiTxHash.slice(0, 10) + '...',
    });

    // Validate before returning
    if (!validateEntropyBundle(bundle)) {
      throw new EntropyError('Entropy validation failed (zero hash detected)', 'VALIDATION_FAILED');
    }

    return bundle;
  } catch (error) {
    if (error instanceof EntropyError) {
      throw error; // Re-throw EntropyError with original contex
    }

    // Wrap unexpected errors
    console.error('[EntropyFetcher] Unexpected error:', error);
    throw new EntropyError(
      'Unexpected error while fetching entropy. Please retry.',
      'VALIDATION_FAILED'
    );
  }
}

/**
 * Validate entropy bundle (all hashes are non-zero)
 */
export function validateEntropyBundle(bundle: EntropyBundle): boolean {
  const zeroHash = '0x0000000000000000000000000000000000000000000000000000000000000000';

  return (
    bundle.btcBlockHash !== zeroHash &&
    bundle.hemiBlockHash !== zeroHash &&
    bundle.ethBlockHash !== zeroHash &&
    bundle.hemiTxHash !== zeroHash
  );
}
