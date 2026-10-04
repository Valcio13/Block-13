import { useState, useRef, useEffect } from 'react';
import Phaser from 'phaser';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createGameConfig } from './game/config';
import { createRun } from './core/run';
import { initRNG, initLocalRNG } from './core/rng';
import { useWallet, useStartRun } from './web3/hooks';
import { useCompleteRun } from './web3/hooks';
import { submitRunCompletion } from './web3/tx2Completion';
import type { Hash } from 'viem';
import { wagmiConfig } from './web3/wagmi';
import type { RunState } from './core/run';

const queryClient = new QueryClient();

type RunStatus = 'idle' | 'connecting' | 'starting' | 'playing' | 'complete';

const stringifyRunSession = (value: unknown) => JSON.stringify(value, (_key, item) =>
  typeof item === 'bigint' ? { __block13Uint256: item.toString(10) } : item,
);
const parseRunSession = (value: string) => JSON.parse(value, (_key, item) =>
  item && typeof item === 'object' && typeof item.__block13Uint256 === 'string'
    ? BigInt(item.__block13Uint256)
    : item,
);

function GameApp() {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [runState, setRunState] = useState<RunState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completionData, setCompletionData] = useState<{ inputLogBytes?: Uint8Array; finalStateBytes?: Uint8Array } | null>(null);
  const [completionHash, setCompletionHash] = useState<Hash | null>(null);
  const [completionPhase, setCompletionPhase] = useState<'idle' | 'wallet' | 'submitted' | 'confirmed' | 'failed'>('idle');
  const [completionError, setCompletionError] = useState<string | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  const { address, isConnected, isCorrectNetwork, connectWallet, switchToHemi } = useWallet();
  const { startRun, isLoading: isStarting, error: startError } = useStartRun();
  const { completeRun } = useCompleteRun();

  // Recover active run from sessionStorage on mount
  useEffect(() => {
    const savedRun = sessionStorage.getItem('activeRun');
    if (savedRun && status === 'idle') {
      try {
        const { runState: savedState } = parseRunSession(savedRun);
        // Only recover if the run was still playing
        if (savedState && savedState.status === 'playing') {
          setRunState(savedState);
          setStatus('playing');
          
          // Re-initialize RNG from saved manifest
          if (savedState.manifest) {
            initRNG(savedState.manifest);
          } else {
            initLocalRNG();
          }
          
          console.log('Recovered active run from refresh');
        }
      } catch (err) {
        console.error('Failed to recover run:', err);
        sessionStorage.removeItem('activeRun');
      }
    }
  }, []);

  // Clear sessionStorage when run completes
  useEffect(() => {
    if (status === 'complete') {
      sessionStorage.removeItem('activeRun');
    }
  }, [status]);

  // Warn user before closing/refreshing during active game
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === 'playing' && runState) {
        e.preventDefault();
        e.returnValue = 'Your game is in progress. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [status, runState]);

  const beginRun = async () => {
    if (!isConnected) {
      setStatus('connecting');
      connectWallet();
      return;
    }

    if (!isCorrectNetwork) {
      setError('Please switch to Hemi Testnet');
      switchToHemi();
      return;
    }

    setStatus('starting');
    setError(null);

    try {
      console.log('[App] Starting blockchain run...');
      const result = await startRun();
      console.log('[App] Run started:', result);
      
      // Initialize RNG from manifest
      initRNG(result.manifest);
      
      // Create run state with manifest
      const newRun = createRun(result.manifest);
      setRunState(newRun);
      
      // Save run to sessionStorage for refresh recovery
      sessionStorage.setItem('activeRun', stringifyRunSession({
        runState: newRun,
        txHash: result.hash,
      }));
      
      setStatus('playing');
    } catch (err: any) {
      console.error('[App] Failed to start run:', err);
      setError(err.message || 'Failed to start run');
      setStatus('idle');
    }
  };

  const beginLocalRun = () => {
    setStatus('playing');
    setError(null);
    
    console.log('[App] Starting local run...');
    
    // Initialize local RNG (no blockchain manifest)
    initLocalRNG();
    
    // Create local-only run (no manifest)
    const localRun = createRun(undefined);
    setRunState(localRun);
    
    // Save to sessionStorage (without blockchain data)
    sessionStorage.setItem('activeRun', stringifyRunSession({
      runState: localRun,
      txHash: null,
    }));
  };

  const handleGameComplete = (finalState: RunState, registry: Phaser.Data.DataManager) => {
    setRunState(finalState);
    setCompletionData({
      inputLogBytes: registry.get('inputLogV2Bytes') as Uint8Array | undefined,
      finalStateBytes: registry.get('finalStateV1Bytes') as Uint8Array | undefined,
    });
    setStatus('complete');
  };

  const submitCompletion = async () => {
    if (!runState?.manifest) return;
    setCompletionPhase('wallet');
    setCompletionError(null);
    try {
      await submitRunCompletion({
        manifest: runState.manifest,
        inputLogBytes: completionData?.inputLogBytes,
        finalStateBytes: completionData?.finalStateBytes,
        submit: (args) => completeRun(args, hash => {
          setCompletionHash(hash);
          setCompletionPhase('submitted');
        }),
        confirm: async () => undefined,
      });
      setCompletionPhase('confirmed');
    } catch (err: any) {
      setCompletionPhase('failed');
      setCompletionError(err.message || 'TX2 submission failed. You can retry.');
    }
  };

  useEffect(() => {
    if (status === 'playing' && gameContainerRef.current && !gameRef.current && runState) {
      const config = createGameConfig('game-container', runState);
      gameRef.current = new Phaser.Game(config);

      // Listen for game completion
      if (gameRef.current.registry) {
        const checkCompletion = setInterval(() => {
          const currentState = gameRef.current?.registry.get('runState') as RunState;
          if (currentState && (currentState.status === 'won' || currentState.status === 'lost')) {
            clearInterval(checkCompletion);
            handleGameComplete(currentState, gameRef.current!.registry);
          }
        }, 1000);

        return () => clearInterval(checkCompletion);
      }
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [status, runState]);

  if (status === 'playing') {
    return (
      <main className="app-shell game-active">
        <div id="game-container" ref={gameContainerRef} />
        {error && (
          <div className="error-overlay">
            <p>{error}</p>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}
      </main>
    );
  }

  if (status === 'complete') {
    const isBlockchainRun = runState?.manifest !== undefined;
    
    return (
      <main className="app-shell">
        <section className="title-card">
          <h1>RUN COMPLETE!</h1>
          {isBlockchainRun ? (
            <p className="premise">Commit this deterministic result and replay hashes to Hemi Testnet.</p>
          ) : (
            <p className="premise">Local run completed (not recorded on-chain)</p>
          )}
          {runState && (
            <div style={{ marginTop: '2rem', color: '#a5b6b5' }}>
              <p>Final Score: {runState.score}</p>
              <p>Floors Completed: {runState.floorsCompleted}</p>
            </div>
          )}
          {isBlockchainRun && runState?.manifest && (
            <div style={{ marginTop: '1rem', color: '#a5b6b5' }}>
              <p>Run ID: {runState.manifest.runId.toString()}</p>
              {completionPhase === 'confirmed' ? (
                <>
                  <p>On-chain completion: Confirmed</p>
                  <p>Transaction: {completionHash ? `${completionHash.slice(0, 10)}…${completionHash.slice(-8)}` : 'Confirmed'}</p>
                </>
              ) : (
                <>
                  {completionPhase === 'wallet' && <p>Waiting for wallet confirmation…</p>}
                  {completionPhase === 'submitted' && <p>Submitting… {completionHash ? `${completionHash.slice(0, 10)}…${completionHash.slice(-8)}` : ''}</p>}
                  {completionError && <p role="alert">{completionError}</p>}
                  <button onClick={submitCompletion} disabled={completionPhase === 'wallet' || completionPhase === 'submitted'}>
                    {completionPhase === 'failed' ? 'Retry Result Submission' : 'Submit Result to Hemi'}
                  </button>
                </>
              )}
              <p>Final score: {runState.score}</p>
            </div>
          )}
          <button onClick={() => window.location.reload()}>New Run</button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="title-card" aria-labelledby="game-title">
        <p className="eyebrow">HEMI ARCADE // SURVIVAL HORROR</p>
        <h1 id="game-title">BLOCK 13</h1>
        <p className="subtitle">DESCENT INTO DARKNESS</p>
        <p className="premise">
          A transaction opened a door inside the building. Find the keys. Descend through floors. Do not let it see you.
        </p>

        {!isConnected ? (
          <>
            <button type="button" onClick={connectWallet} disabled={status === 'connecting'}>
              {status === 'connecting' ? 'CONNECTING...' : 'CONNECT WALLET'}
            </button>
            <button 
              type="button" 
              onClick={beginLocalRun} 
              style={{ 
                marginTop: '1rem',
                background: 'transparent',
                border: '1px solid #4a5568',
                color: '#a5b6b5'
              }}
            >
              PLAY WITHOUT WALLET
            </button>
            <p className="run-rule" style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#6b7280' }}>
              Local mode: score will not be recorded on-chain
            </p>
          </>
        ) : !isCorrectNetwork ? (
          <button type="button" onClick={switchToHemi}>
            SWITCH TO HEMI TESTNET
          </button>
        ) : (
          <>
            <button type="button" onClick={beginRun} disabled={status === 'starting'}>
              {status === 'starting' ? 'FETCHING ENTROPY...' : 'START RUN (BLOCKCHAIN)'}
            </button>
            <button 
              type="button" 
              onClick={beginLocalRun} 
              style={{ 
                marginTop: '1rem',
                background: 'transparent',
                border: '1px solid #4a5568',
                color: '#a5b6b5'
              }}
            >
              PLAY WITHOUT BLOCKCHAIN
            </button>
          </>
        )}

        {isConnected && (
          <p className="run-rule" style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
            Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        )}

        <p className="run-rule">Multi-chain entropy: BTC · Hemi · Ethereum</p>
        <p className="run-rule">2 transactions: start run · commit result</p>

        {(error || startError) && (
          <p style={{ color: '#ff4444', marginTop: '1rem' }}>{error || startError}</p>
        )}
      </section>
    </main>
  );
}

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <GameApp />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
