/**
 * Entropy Fetcher
 * 
 * Fetches recent block hashes from BTC, Hemi, and Ethereum chains
 * to use as entropy sources for run manifest creation.
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
 * Fetch recent Ethereum mainnet block hash
 */
async function fetchEthBlockHash(): Promise<`0x${string}`> {
  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http('https://eth.llamarpc.com'), // Public RPC
    });

    const block = await client.getBlock({ blockTag: 'latest' });
    return block.hash || '0x0000000000000000000000000000000000000000000000000000000000000000';
  } catch (error) {
    console.error('Failed to fetch ETH block hash:', error);
    // Fallback: use a deterministic hash based on timestamp
    return generateFallbackHash('eth');
  }
}

/**
 * Fetch recent Hemi block hash (not the current tx's block)
 */
async function fetchHemiBlockHash(client: PublicClient): Promise<`0x${string}`> {
  try {
    const latestBlock = await client.getBlockNumber();
    // Get block that's at least 2 blocks old (confirmed)
    const targetBlock = latestBlock - 2n;
    const block = await client.getBlock({ blockNumber: targetBlock });
    return block.hash || '0x0000000000000000000000000000000000000000000000000000000000000000';
  } catch (error) {
    console.error('Failed to fetch Hemi block hash:', error);
    return generateFallbackHash('hemi');
  }
}

/**
 * Fetch recent confirmed Hemi transaction hash
 * Uses a recent transaction from the mempool or recent blocks
 */
async function fetchHemiTxHash(client: PublicClient, userAddress: string): Promise<`0x${string}`> {
  try {
    const latestBlock = await client.getBlockNumber();
    // Look for recent transactions (last 10 blocks)
    for (let i = 0; i < 10; i++) {
      const blockNumber = latestBlock - BigInt(i);
      const block = await client.getBlock({ blockNumber, includeTransactions: true });
      
      if (block.transactions && block.transactions.length > 0) {
        // Find a transaction that's NOT from the current user (to avoid correlation)
        const tx = block.transactions.find((t: any) => 
          typeof t === 'object' && t.from?.toLowerCase() !== userAddress.toLowerCase()
        );
        
        if (tx && typeof tx === 'object' && tx.hash) {
          return tx.hash as `0x${string}`;
        }
      }
    }

    // Fallback: use latest block hash if no suitable tx found
    const block = await client.getBlock({ blockTag: 'latest' });
    return block.hash || generateFallbackHash('hemi-tx');
  } catch (error) {
    console.error('Failed to fetch Hemi tx hash:', error);
    return generateFallbackHash('hemi-tx');
  }
}

/**
 * Fetch Bitcoin block hash
 * 
 * NOTE: This requires a Bitcoin RPC endpoint or API.
 * For MVP, we'll use a placeholder that should be replaced with:
 * - Hemi Bitcoin Kit integration
 * - Public Bitcoin API (blockchain.info, blockstream, etc.)
 * - Your own Bitcoin node RPC
 */
async function fetchBtcBlockHash(): Promise<`0x${string}`> {
  try {
    // TEMPORARY: Using blockstream.info API for Bitcoin testnet
    // Replace with Hemi Bitcoin Kit when available
    const response = await fetch('https://blockstream.info/api/blocks/tip/height');
    const height = await response.json();
    
    const blockResponse = await fetch(`https://blockstream.info/api/block-height/${height}`);
    const blockHash = await blockResponse.text();
    
    // Convert Bitcoin hash (reverse byte order) to 0x-prefixed hex
    // Bitcoin uses reverse byte order for display
    return ('0x' + blockHash) as `0x${string}`;
  } catch (error) {
    console.error('Failed to fetch BTC block hash:', error);
    console.warn('Using fallback BTC hash - REPLACE WITH HEMI BITCOIN KIT IN PRODUCTION');
    return generateFallbackHash('btc');
  }
}

/**
 * Generate deterministic fallback hash when API calls fail
 * NOT cryptographically secure, just prevents app from breaking
 */
function generateFallbackHash(source: string): `0x${string}` {
  const timestamp = Date.now();
  const data = `${source}:${timestamp}`;
  
  // Simple hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data.charCodeAt(i);
    hash = hash & hash;
  }
  
  const hashHex = Math.abs(hash).toString(16).padStart(64, '0');
  return ('0x' + hashHex) as `0x${string}`;
}

/**
 * Fetch all entropy sources
 * 
 * @param hemiClient - Viem public client connected to Hemi
 * @param userAddress - Current user's address (to avoid using their own tx)
 */
export async function fetchEntropyBundle(
  hemiClient: PublicClient,
  userAddress: string
): Promise<EntropyBundle> {
  console.log('[EntropyFetcher] Fetching entropy from multiple chains...');

  // Fetch all sources in parallel for speed
  const [btcBlockHash, hemiBlockHash, ethBlockHash, hemiTxHash] = await Promise.all([
    fetchBtcBlockHash(),
    fetchHemiBlockHash(hemiClient),
    fetchEthBlockHash(),
    fetchHemiTxHash(hemiClient, userAddress),
  ]);

  console.log('[EntropyFetcher] Entropy bundle collected:', {
    btcBlockHash: btcBlockHash.slice(0, 10) + '...',
    hemiBlockHash: hemiBlockHash.slice(0, 10) + '...',
    ethBlockHash: ethBlockHash.slice(0, 10) + '...',
    hemiTxHash: hemiTxHash.slice(0, 10) + '...',
  });

  return {
    btcBlockHash,
    hemiBlockHash,
    ethBlockHash,
    hemiTxHash,
  };
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
