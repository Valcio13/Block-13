import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, usePublicClient } from 'wagmi';
import { hemiTestnet, CONTRACT_ADDRESS, RUN_REGISTRY_ABI } from './config';
import { useState, useCallback } from 'react';
import { hexToBigInt, type Hash } from 'viem';

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

export function useStartRun() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash || undefined,
  });

  const startRun = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: RUN_REGISTRY_ABI,
        functionName: 'startRun',
        args: [],
      });

      setTxHash(hash);

      // Wait for transaction receipt to get event logs
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });

      // Parse RunStarted event
      const log = receipt.logs.find(
        (log) =>
          log.topics[0] === '0x' + '...' // RunStarted event signature
      );

      if (!log || log.topics.length < 3 || !log.topics[2]) {
        throw new Error('Failed to parse RunStarted event');
      }

      const nonce = hexToBigInt(log.topics[2] as `0x${string}`);
      const seed = log.data;

      setIsLoading(false);
      return { nonce: Number(nonce), seed, hash };
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
      setIsLoading(false);
      throw err;
    }
  }, [writeContractAsync, publicClient]);

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
    async (nonce: number, score: number, actionHash: string) => {
      setIsLoading(true);
      setError(null);
      setTxHash(null);

      try {
        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: RUN_REGISTRY_ABI,
          functionName: 'submitScore',
          args: [BigInt(nonce), score, actionHash as `0x${string}`],
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
