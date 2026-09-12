import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, usePublicClient } from 'wagmi';
import { hemiTestnet, CONTRACT_ADDRESS, RUN_REGISTRY_ABI } from './config';
import { useState, useCallback } from 'react';
import { type Hash } from 'viem';
import { fetchEntropyBundle, validateEntropyBundle, type EntropyBundle } from './entropyFetcher';
import type { RunManifest } from '../core/seedDerivation';

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
const GAME_VERSION = '0.1.0';
const DEFAULT_CHARACTER = 'survivor';
const DEFAULT_RULES = 'classic';

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

  const startRun = useCallback(async (gameMode: number = 0): Promise<{ runId: number; manifest: RunManifest; hash: Hash }> => {
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

      console.log('[useStartRun] Entropy validated, starting run transaction...');

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
      
      if (runIdBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error('RunId too large');
      }
      
      const runId = Number(runIdBigInt);
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

export function useSubmitScore() {
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash || undefined,
  });

  const submitScore = useCallback(
    async (runId: number, score: number, actionHash: string) => {
      setIsLoading(true);
      setError(null);
      setTxHash(null);

      try {
        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: RUN_REGISTRY_ABI,
          functionName: 'submitScore',
          args: [BigInt(runId), score, actionHash as `0x${string}`],
        });

        setTxHash(hash);
        setIsLoading(false);
        return { hash };
      } catch (err: any) {
        setError(err.message || 'Transaction failed');
        setIsLoading(false);
        throw err;
      }
    },
    [writeContractAsync]
  );

  return {
    submitScore,
    isLoading: isLoading || isConfirming,
    isSuccess,
    error,
    txHash,
  };
}
