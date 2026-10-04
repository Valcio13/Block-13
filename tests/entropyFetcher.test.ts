import { describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { deriveSeeds } from '../src/core/seedDerivation';
import {
  EntropyError,
  fetchBitcoinBlockReference,
  fetchEntropyBundle,
  fetchEthereumBlockReference,
} from '../src/web3/entropyFetcher';

const hash = (byte: string) => `0x${byte.repeat(64)}`;
const ETH_HASH = hash('a');
const BTC_HASH = 'b'.repeat(64);

function fetchMock(impl: (url: string) => string | Error): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const value = impl(String(input));
    if (value instanceof Error) throw value;
    return new Response(value, { status: 200 });
  }) as unknown as typeof fetch;
}

function btcResponse(url: string, hashes: Record<string, string>, tips: Record<string, string> = {}) {
  const endpoint = new URL(url).origin;
  if (url.endsWith('/blocks/tip/height')) return tips[endpoint] ?? '100';
  if (url.endsWith('/block-height/99')) return hashes[endpoint] ?? BTC_HASH;
  return new Error(`unexpected request ${url}`);
}

describe('browser entropy acquisition', () => {
  it('uses the configured Ethereum primary when it succeeds', async () => {
    const visited: string[] = [];
    const ref = await fetchEthereumBlockReference({
      rpcUrls: ['https://eth-primary.test', 'https://eth-fallback.test'],
      createReader: url => ({ getBlock: vi.fn(async () => {
        visited.push(url);
        return { number: 20n, hash: ETH_HASH };
      }) }),
    });
    expect(ref).toEqual({ height: 20n, hash: ETH_HASH });
    expect(visited).toEqual(['https://eth-primary.test']);
  });

  it('tries Ethereum fallback in fixed order after bounded primary retries', async () => {
    const visited: string[] = [];
    const ref = await fetchEthereumBlockReference({
      rpcUrls: ['https://eth-primary.test', 'https://eth-fallback.test'],
      createReader: url => ({ getBlock: vi.fn(async () => {
        visited.push(url);
        if (url.includes('primary')) throw new Error('primary unavailable');
        return { number: 20n, hash: ETH_HASH };
      }) }),
    });
    expect(ref.hash).toBe(ETH_HASH);
    expect(visited).toEqual([
      'https://eth-primary.test', 'https://eth-primary.test', 'https://eth-fallback.test',
    ]);
  });

  it('reports a clear error when all Ethereum RPC endpoints fail', async () => {
    const getBlock = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(fetchEthereumBlockReference({
      rpcUrls: ['https://eth.test'],
      createReader: () => ({ getBlock }),
    })).rejects.toMatchObject({ message: 'Unable to fetch Ethereum block reference', code: 'NO_ETH_BLOCK' });
    expect(getBlock).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed Ethereum block number and hash responses', async () => {
    for (const block of [
      { number: null, hash: ETH_HASH },
      { number: 3n, hash: '0xnot-a-hash' },
      { number: 3n, hash: hash('0') },
    ]) {
      await expect(fetchEthereumBlockReference({
        rpcUrls: ['https://eth.test'],
        createReader: () => ({ getBlock: vi.fn().mockResolvedValue(block) }),
      })).rejects.toBeInstanceOf(EntropyError);
    }
  });

  it('uses the Bitcoin primary and checks the canonical hash at tip minus one', async () => {
    const fetchImpl = fetchMock(url => btcResponse(url, {
      'https://btc-primary.test': BTC_HASH,
      'https://btc-fallback.test': BTC_HASH,
    }));
    const reference = await fetchBitcoinBlockReference({
      providers: ['https://btc-primary.test', 'https://btc-fallback.test'], fetchImpl,
    });
    expect(reference).toEqual({ height: 99n, hash: `0x${BTC_HASH}` });
    expect(fetchImpl).toHaveBeenCalledWith('https://btc-primary.test/blocks/tip/height', expect.anything());
    expect(fetchImpl).toHaveBeenCalledWith('https://btc-fallback.test/block-height/99', expect.anything());
  });

  it('falls back to mempool.space when Blockstream transport is unavailable', async () => {
    const fetchImpl = fetchMock(url => {
      if (url.startsWith('https://btc-primary.test')) return new Error('DNS unavailable');
      return btcResponse(url, { 'https://btc-fallback.test': BTC_HASH });
    });
    const reference = await fetchBitcoinBlockReference({
      providers: ['https://btc-primary.test', 'https://btc-fallback.test'], fetchImpl,
    });
    expect(reference).toEqual({ height: 99n, hash: `0x${BTC_HASH}` });
  });

  it('rejects malformed Bitcoin hashes and disagreement at the selected height', async () => {
    await expect(fetchBitcoinBlockReference({
      providers: ['https://btc-primary.test'],
      fetchImpl: fetchMock(url => url.endsWith('/blocks/tip/height') ? 'height 100' : BTC_HASH),
    })).rejects.toMatchObject({ message: 'Unable to fetch Bitcoin block reference' });

    await expect(fetchBitcoinBlockReference({
      providers: ['https://btc-primary.test'],
      fetchImpl: fetchMock(url => url.endsWith('/blocks/tip/height') ? '100' : 'not-a-32-byte-hash'),
    })).rejects.toMatchObject({ message: 'Unable to fetch Bitcoin block reference' });

    await expect(fetchBitcoinBlockReference({
      providers: ['https://btc-primary.test', 'https://btc-fallback.test'],
      fetchImpl: fetchMock(url => btcResponse(url, {
        'https://btc-primary.test': BTC_HASH,
        'https://btc-fallback.test': 'c'.repeat(64),
      })),
    })).rejects.toMatchObject({ message: 'Unable to fetch Bitcoin block reference' });
  });

  it('preserves the Hemi N-2 reference and canonical tx rule and returns a seed-compatible bundle', async () => {
    const hemiHash = hash('d');
    const hemiTxHash = hash('e');
    const transaction = {
      hash: hemiTxHash,
      from: '0x2222222222222222222222222222222222222222',
      transactionIndex: 0,
    };
    const getBlock = vi.fn(async (args: { blockNumber: bigint; includeTransactions?: boolean }) => ({
      hash: hemiHash,
      number: args.blockNumber,
      transactions: args.includeTransactions ? [transaction] : [],
    }));
    const hemiClient = {
      getBlockNumber: vi.fn(async () => 100n),
      getBlock,
      getTransactionReceipt: vi.fn(async () => ({ status: 'success', gasUsed: 30_000n })),
    } as unknown as PublicClient;
    const fetchImpl = fetchMock(url => btcResponse(url, {
      'https://btc.test': BTC_HASH,
    }));
    const ethHash = hash('f');
    const bundle = await fetchEntropyBundle(hemiClient, '0x1111111111111111111111111111111111111111', {
      btcProviders: ['https://btc.test'], fetchImpl,
      ethRpcUrls: ['https://eth.test'],
      createEthReader: () => ({ getBlock: vi.fn(async () => ({ number: 50n, hash: ethHash })) }),
    });

    expect(bundle).toEqual({ btcBlockHash: `0x${BTC_HASH}`, hemiBlockHash: hemiHash, ethBlockHash: ethHash, hemiTxHash });
    expect(getBlock).toHaveBeenCalledWith({ blockNumber: 98n });
    const seeds = deriveSeeds({
      runId: 7n,
      player: '0x1111111111111111111111111111111111111111',
      gameVersion: hash('1'), rulesHash: hash('2'),
      btcBlockHash: bundle.btcBlockHash, hemiBlockHash: bundle.hemiBlockHash,
      ethBlockHash: bundle.ethBlockHash, hemiTxHash: bundle.hemiTxHash, startedAt: 0,
    });
    expect(typeof seeds.world).toBe('bigint');
    expect(typeof seeds.economy).toBe('bigint');
    expect(typeof seeds.event).toBe('bigint');
  });
});
