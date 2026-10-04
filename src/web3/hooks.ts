import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, usePublicClient } from 'wagmi';
import { hemiTestnet, CONTRACT_ADDRESS, RUN_REGISTRY_ABI } from './config';
import { useState, useCallback } from 'react';
import { type Hash } from 'viem';
import { fetchEntropyBundle, validateEntropyBundle, type EntropyBundle } from './entropyFetcher';
import type { RunManifest } from '../core/seedDerivation';
import type { CompleteRunArgs } from './tx2Completion';

export function useWallet() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const isCorrectNetwork = chain?.id === hemiTestnet.id;

  const connectWallet = useCallback(() => {
    const injected = connectors.find((c) => c.type === 'injected');
    if (injected) {
      connect({ connector: injected });
    }
  }, [connect, connectors]);

  const switchToHemi = useCallback(() => {
    if (switchChain) {
      switchChain({ chainId: hemiTestnet.id });
    }
  }, [switchChain]);

  return {
    address,
    isConnected,
    isCorrectNetwork,
    chain,
    connectWallet,
    disconnect,
    switchToHemi,
  };
}

/**
 * Game configuration constants
 */
const GAME_VERSION = '0.2.0';
const DEFAULT_CHARACTER = 'survivor';
const DEFAULT_RULES = 'classic-static-walls';

// Convert strings to bytes32 format for contract
function stringToBytes32(str: string): `0x${string}` {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hex = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
  return ('0x' + hex.padEnd(64, '0')) as `0x${string}`;
}

export function useStartRun() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash || undefined,
  });

  const startRun = useCallback(async (gameMode: number = 0): Promise<{ runId: bigint; manifest: RunManifest; hash: Hash }> => {
    if (!publicClient || !address) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      console.log('[useStartRun] Fetching entropy sources...');
      
      // Fetch entropy from multiple chains
      const entropy: EntropyBundle = await fetchEntropyBundle(publicClient, address);
      
      if (!validateEntropyBundle(entropy)) {
        throw new Error('Failed to fetch valid entropy sources');
      }

      console.log('[useStartRun] Entropy bundle complete; requesting wallet TX1');

      // Convert game config to bytes32
      const gameVersion = stringToBytes32(GAME_VERSION);
      const character = stringToBytes32(DEFAULT_CHARACTER);
      const rulesHash = stringToBytes32(DEFAULT_RULES);

      // Call startRun with all entropy sources
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: RUN_REGISTRY_ABI,
        functionName: 'startRun',
        args: [
          gameMode,
          gameVersion,
          character,
          rulesHash,
          entropy.btcBlockHash,
          entropy.hemiBlockHash,
          entropy.ethBlockHash,
          entropy.hemiTxHash,
        ],
      });

      setTxHash(hash);
      console.log('[useStartRun] Transaction submitted:', hash);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('[useStartRun] Transaction confirmed');

      // Parse RunStarted event to get runId
      const log = receipt.logs.find(
        (log) =>
          log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() &&
          log.topics.length >= 2 // player (indexed) + runId (indexed)
      );

      if (!log || !log.topics[2]) {
        throw new Error('Failed to parse RunStarted event');
      }

      // topics[2] is the indexed runId
      const runIdBigInt = BigInt(log.topics[2]);
      
      const runId = runIdBigInt;
      console.log('[useStartRun] Run started with ID:', runId);

      // Create manifest for local use
      const manifest: RunManifest = {
        runId,
        player: address,
        gameVersion: gameVersion,
        rulesHash: rulesHash,
        btcBlockHash: entropy.btcBlockHash,
        hemiBlockHash: entropy.hemiBlockHash,
        ethBlockHash: entropy.ethBlockHash,
        hemiTxHash: entropy.hemiTxHash,
        startedAt: Date.now(),
      };

      setIsLoading(false);
      return { runId, manifest, hash };
    } catch (err: any) {
      const errorMsg = err.message || 'Transaction failed';
      console.error('[useStartRun] Error:', errorMsg);
      setError(errorMsg);
      setIsLoading(false);
      throw err;
    }
  }, [writeContractAsync, publicClient, address]);

  return {
    startRun,
    isLoading: isLoading || isConfirming,
    isSuccess,
    error,
    txHash,
  };
}

/** Submit and confirm a deterministic result commitment on Hemi Testnet. */
export function useCompleteRun() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const completeRun = useCallback(
    async (args: CompleteRunArgs, onSubmitted?: (hash: Hash) => void) => {
      if (!publicClient) throw new Error('Hemi Testnet client is unavailable');
      setIsLoading(true);
      setError(null);
      setTxHash(null);
      setIsSuccess(false);

      try {
        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: RUN_REGISTRY_ABI,
          functionName: 'completeRun',
          args: [args.runId, args.score, args.outcome, args.terminalTick, args.inputHash, args.finalStateHash],
        });
        setTxHash(hash);
        onSubmitted?.(hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') throw new Error('TX2 completion transaction reverted');
        setIsSuccess(true);
        setIsLoading(false);
        return hash;
      } catch (err: any) {
        const message = err.message || 'Transaction failed';
        setError(message);
        setIsLoading(false);
        throw err;
      }
    },
    [writeContractAsync, publicClient]
  );

  return {
    completeRun,
    isLoading,
    isSuccess,
    error,
    txHash,
  };
}
