import { useState, useRef, useEffect } from 'react';
import Phaser from 'phaser';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createGameConfig } from './game/config';
import { createRun, seedFromBytes32, generateActionHash } from './core/run';
import { useWallet, useStartRun, useSubmitScore } from './web3/hooks';
import { wagmiConfig } from './web3/wagmi';
import type { RunState } from './core/run';

const queryClient = new QueryClient();

type RunStatus = 'idle' | 'connecting' | 'starting' | 'playing' | 'submitting' | 'complete';

function GameApp() {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [runState, setRunState] = useState<RunState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  const { address, isConnected, isCorrectNetwork, connectWallet, switchToHemi } = useWallet();
  const { startRun, isLoading: isStarting, error: startError } = useStartRun();
  const { submitScore, isLoading: isSubmitting, isSuccess: submitSuccess } = useSubmitScore();

  // Recover active run from sessionStorage on mount
  useEffect(() => {
    const savedRun = sessionStorage.getItem('activeRun');
    if (savedRun && status === 'idle') {
      try {
        const { runState: savedState } = JSON.parse(savedRun);
        // Only recover if the run was still playing
        if (savedState && savedState.status === 'playing') {
          setRunState(savedState);
          setStatus('playing');
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
      const result = await startRun();
      const seed = seedFromBytes32(result.seed);
      const newRun = createRun(seed, result.nonce, address);
      setRunState(newRun);
      
      // Save run to sessionStorage for refresh recovery
      sessionStorage.setItem('activeRun', JSON.stringify({
        runState: newRun,
        txHash: result.hash,
      }));
      
      setStatus('playing');
    } catch (err: any) {
      setError(err.message || 'Failed to start run');
      setStatus('idle');
    }
  };

  const beginLocalRun = () => {
    setStatus('playing');
    setError(null);
    
    // Generate local-only run with random seed
    const localSeed = Math.floor(Math.random() * 0xFFFFFFFF);
    const localRun = createRun(localSeed, undefined, undefined);
    setRunState(localRun);
    
    // Save to sessionStorage (without blockchain data)
    sessionStorage.setItem('activeRun', JSON.stringify({
      runState: localRun,
      txHash: null,
    }));
  };

  const handleGameComplete = async (finalState: RunState) => {
    // Check if this is a blockchain run
    if (finalState.nonce === undefined || !address) {
      // Local-only run completed
      setStatus('complete');
      return;
    }

    // Prevent duplicate submission
    if (status === 'submitting' || status === 'complete') {
      console.warn('Score already submitted or in progress');
      return;
    }

    setStatus('submitting');

    try {
      const actionHash = generateActionHash(finalState.nonce, finalState.score);
      await submitScore(finalState.nonce, finalState.score, actionHash);
      setStatus('complete');
    } catch (err: any) {
      setError(err.message || 'Failed to submit score');
      setStatus('playing'); // Allow retry by keeping in playing state
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
          if (currentState && currentState.status === 'won') {
            clearInterval(checkCompletion);
            handleGameComplete(currentState);
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

  if (status === 'submitting') {
    return (
      <main className="app-shell">
        <section className="title-card">
          <h1>SUBMITTING SCORE...</h1>
          <p>Transaction pending on Hemi Testnet</p>
        </section>
      </main>
    );
  }

  if (status === 'complete' || submitSuccess) {
    const isBlockchainRun = runState?.nonce !== undefined;
    
    return (
      <main className="app-shell">
        <section className="title-card">
          <h1>RUN COMPLETE!</h1>
          {isBlockchainRun ? (
            <p className="premise">Score submitted to Hemi blockchain</p>
          ) : (
            <p className="premise">Local run completed (not recorded on-chain)</p>
          )}
          {runState && (
            <div style={{ marginTop: '2rem', color: '#a5b6b5' }}>
              <p>Final Score: {runState.score}</p>
              <p>Floors Completed: {runState.floorsCompleted}</p>
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
          A transaction opened a door inside the building. Find the keys. Descend three floors. Do not let it see you.
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
          <button type="button" onClick={beginRun} disabled={status === 'starting'}>
            {status === 'starting' ? 'STARTING RUN...' : 'START RUN'}
          </button>
        )}

        {isConnected && (
          <p className="run-rule" style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
            Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        )}

        <p className="run-rule">2 transactions only: start run · submit score</p>

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
