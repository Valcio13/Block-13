/** Browser-side, bounded multi-chain entropy acquisition. */
import { createPublicClient, http, type PublicClient } from 'viem';
import { mainnet } from 'viem/chains';
import { hemiTestnet } from './config';

export interface EntropyBundle {
  btcBlockHash: `0x${string}`;
  hemiBlockHash: `0x${string}`;
  ethBlockHash: `0x${string}`;
  hemiTxHash: `0x${string}`;
}

export class EntropyError extends Error {
  constructor(
    message: string,
    public code: 'NO_BTC_BLOCK' | 'NO_HEMI_BLOCK' | 'NO_ETH_BLOCK' | 'NO_HEMI_TX' | 'VALIDATION_FAILED',
  ) {
    super(message);
    this.name = 'EntropyError';
  }
}

export interface BlockReference {
  height: bigint;
  hash: `0x${string}`;
}

const ETH_RPC_FALLBACKS = ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org'];
const BTC_ESPLORA_FALLBACKS = ['https://blockstream.info/api', 'https://mempool.space/api'];
const REQUEST_TIMEOUT_MS = 4_000;
const HTTP_ATTEMPTS_PER_PROVIDER = 2;
const ETH_ATTEMPTS_PER_PROVIDER = 2;
const ZERO_HASH = `0x${'00'.repeat(32)}`;
const HEX32 = /^0x[0-9a-f]{64}$/i;

type EthBlockReader = {
  getBlock: (args: { blockTag: 'latest' }) => Promise<{ number: bigint | null; hash: `0x${string}` | null }>;
};
type EntropyFetchOptions = {
  btcProviders?: string[];
  ethRpcUrls?: string[];
  fetchImpl?: typeof fetch;
  createEthReader?: (url: string) => EthBlockReader;
};

function uniqueUrls(urls: Array<string | undefined>): string[] {
  return [...new Set(urls.map(url => url?.trim().replace(/\/+$/, '')).filter((url): url is string => Boolean(url)))];
}

function configuredEthRpcUrls(): string[] {
  return uniqueUrls([import.meta.env.VITE_ETH_RPC_URL, ...ETH_RPC_FALLBACKS]);
}

function createEthReader(url: string): EthBlockReader {
  const client = createPublicClient({
    chain: mainnet,
    transport: http(url, { timeout: REQUEST_TIMEOUT_MS, retryCount: 0 }),
  });
  return { getBlock: args => client.getBlock(args) };
}

function validHash(hash: unknown): hash is `0x${string}` {
  return typeof hash === 'string' && HEX32.test(hash) && hash.toLowerCase() !== ZERO_HASH;
}

/** Ethereum semantics remain the latest mainnet block; endpoint priority is fixed. */
export async function fetchEthereumBlockReference(options: {
  rpcUrls?: string[];
  createReader?: (url: string) => EthBlockReader;
} = {}): Promise<BlockReference> {
  const urls = uniqueUrls(options.rpcUrls ?? configuredEthRpcUrls());
  const makeReader = options.createReader ?? createEthReader;

  for (const url of urls) {
    for (let attempt = 0; attempt < ETH_ATTEMPTS_PER_PROVIDER; attempt++) {
      try {
        const block = await makeReader(url).getBlock({ blockTag: 'latest' });
        if (block.number === null || block.number < 0n || !validHash(block.hash)) {
          throw new Error('Malformed latest Ethereum block response');
        }
        return { height: block.number, hash: block.hash.toLowerCase() as `0x${string}` };
      } catch {
        // Fixed-order retry/fallback. Never race providers and take whichever responds first.
      }
    }
  }

  throw new EntropyError('Unable to fetch Ethereum block reference', 'NO_ETH_BLOCK');
}

function requestText(url: string, fetchImpl: typeof fetch): Promise<string> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    fetchImpl(url, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        resolve((await response.text()).trim());
      })
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

async function requestTextWithRetry(url: string, fetchImpl: typeof fetch): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < HTTP_ATTEMPTS_PER_PROVIDER; attempt++) {
    try {
      return await requestText(url, fetchImpl);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function parseBitcoinHeight(raw: string): bigint {
  if (!/^\d+$/.test(raw)) throw new Error('Malformed Bitcoin block height');
  const height = BigInt(raw);
  if (height < 1n) throw new Error('Bitcoin chain has no confirmed block');
  return height;
}

function parseBitcoinHash(raw: string): `0x${string}` {
  if (!/^[0-9a-f]{64}$/i.test(raw)) throw new Error('Malformed Bitcoin block hash');
  const hash = `0x${raw.toLowerCase()}` as `0x${string}`;
  if (hash === ZERO_HASH) throw new Error('Zero Bitcoin block hash');
  return hash;
}

/**
 * Select tip-1 using a fixed provider priority, then query that exact height
 * from every available Esplora provider. Provider disagreement is fatal.
 */
export async function fetchBitcoinBlockReference(options: {
  providers?: string[];
  fetchImpl?: typeof fetch;
} = {}): Promise<BlockReference> {
  const providers = uniqueUrls(options.providers ?? BTC_ESPLORA_FALLBACKS);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  let selectedHeight: bigint | undefined;

  for (const provider of providers) {
    try {
      const tip = parseBitcoinHeight(await requestTextWithRetry(`${provider}/blocks/tip/height`, fetchImpl));
      selectedHeight = tip - 1n; // Preserve the existing one-confirmation rule.
      break;
    } catch {
      // Move through a deterministic priority list, never a response race.
    }
  }

  if (selectedHeight === undefined || selectedHeight < 0n) {
    throw new EntropyError('Unable to fetch Bitcoin block reference', 'NO_BTC_BLOCK');
  }

  const responses = await Promise.all(providers.map(async provider => {
    try {
      const raw = await requestTextWithRetry(`${provider}/block-height/${selectedHeight}`, fetchImpl);
      return parseBitcoinHash(raw);
    } catch {
      return undefined;
    }
  }));
  const hashes = responses.filter((hash): hash is `0x${string}` => hash !== undefined);
  if (hashes.length === 0 || hashes.some(hash => hash !== hashes[0])) {
    throw new EntropyError('Unable to fetch Bitcoin block reference', 'NO_BTC_BLOCK');
  }
  return { height: selectedHeight, hash: hashes[0] };
}

async function fetchHemiBlockReference(client: PublicClient): Promise<{ height: bigint; hash: `0x${string}` }> {
  try {
    const latestBlock = await client.getBlockNumber();
    const targetBlock = latestBlock - 2n;
    if (targetBlock < 0n) throw new Error('Insufficient confirmed blocks');
    const block = await client.getBlock({ blockNumber: targetBlock });
    if (!validHash(block.hash)) throw new Error('Malformed Hemi block hash');
    return { height: targetBlock, hash: block.hash };
  } catch {
    throw new EntropyError('Unable to fetch Hemi entropy', 'NO_HEMI_BLOCK');
  }
}

/** Canonical Hemi tx policy is unchanged: first successful external contract tx by index, within N-2..N-11. */
async function selectCanonicalHemiTx(
  client: PublicClient,
  hemiBlockNumber: bigint,
  userAddress: string,
): Promise<`0x${string}`> {
  const maxLookback = 10;
  const normalizedUserAddress = userAddress.toLowerCase();

  for (let offset = 0; offset < maxLookback; offset++) {
    const blockNumber = hemiBlockNumber - BigInt(offset);
    if (blockNumber < 0n) break;
    try {
      const block = await client.getBlock({ blockNumber, includeTransactions: true });
      if (!block.transactions || block.transactions.length === 0) continue;
      const txs = [...block.transactions].sort((a, b) => {
        if (typeof a !== 'object' || typeof b !== 'object') return 0;
        return (a.transactionIndex ?? 0) - (b.transactionIndex ?? 0);
      });
      for (const tx of txs) {
        if (typeof tx !== 'object' || !tx.hash) continue;
        try {
          const receipt = await client.getTransactionReceipt({ hash: tx.hash });
          if (receipt.status === 'success' && tx.from.toLowerCase() !== normalizedUserAddress && receipt.gasUsed > 21_000n) {
            console.log('[EntropyFetcher] Canonical Hemi transaction selected');
            return tx.hash;
          }
        } catch {
          // A receipt unavailable from the selected Hemi RPC is not a candidate.
        }
      }
    } catch {
      // Continue in the fixed canonical lookback order.
    }
  }

  throw new EntropyError('Unable to fetch Hemi entropy: no eligible transaction in the canonical lookback window', 'NO_HEMI_TX');
}

export async function fetchEntropyBundle(
  hemiClient: PublicClient,
  userAddress: string,
  options: EntropyFetchOptions = {},
): Promise<EntropyBundle> {
  console.log('[EntropyFetcher] Fetching entropy sources');
  try {
    const hemiReference = await fetchHemiBlockReference(hemiClient);
    console.log(`[EntropyFetcher] Hemi reference acquired at ${hemiReference.height}`);
    const [btcReference, ethReference, hemiTxHash] = await Promise.all([
      fetchBitcoinBlockReference({ providers: options.btcProviders, fetchImpl: options.fetchImpl })
        .then(reference => { console.log(`[EntropyFetcher] BTC reference acquired at ${reference.height}`); return reference; }),
      fetchEthereumBlockReference({ rpcUrls: options.ethRpcUrls, createReader: options.createEthReader })
        .then(reference => { console.log(`[EntropyFetcher] Ethereum reference acquired at ${reference.height}`); return reference; }),
      selectCanonicalHemiTx(hemiClient, hemiReference.height, userAddress),
    ]);
    const bundle: EntropyBundle = {
      btcBlockHash: btcReference.hash,
      hemiBlockHash: hemiReference.hash,
      ethBlockHash: ethReference.hash,
      hemiTxHash,
    };
    if (!validateEntropyBundle(bundle)) throw new EntropyError('Unable to fetch entropy bundle', 'VALIDATION_FAILED');
    console.log('[EntropyFetcher] Entropy bundle complete');
    return bundle;
  } catch (error) {
    if (error instanceof EntropyError) throw error;
    throw new EntropyError('Unable to fetch Hemi entropy', 'NO_HEMI_BLOCK');
  }
}

export function validateEntropyBundle(bundle: EntropyBundle): boolean {
  return [bundle.btcBlockHash, bundle.hemiBlockHash, bundle.ethBlockHash, bundle.hemiTxHash]
    .every(hash => validHash(hash));
}
