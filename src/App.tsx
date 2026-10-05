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
import { onchainStartupCopy, resultHandoffReady, runMenuActions, startupErrorCopy, terminalSubmissionStatus } from './game/contestUx';

const queryClient = new QueryClient();

type RunStatus = 'idle' | 'starting' | 'ready' | 'playing' | 'complete';
type MenuStartPhase = 'idle' | 'entropy' | 'wallet' | 'submitted' | 'confirmed';

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
  const [startPhase, setStartPhase] = useState<MenuStartPhase>('idle');
  const [runState, setRunState] = useState<RunState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completionData, setCompletionData] = useState<{ inputLogBytes?: Uint8Array; finalStateBytes?: Uint8Array } | null>(null);
  const [completionHash, setCompletionHash] = useState<Hash | null>(null);
  const [completionPhase, setCompletionPhase] = useState<'idle' | 'wallet' | 'submitted' | 'confirmed' | 'failed'>('idle');
  const [completionError, setCompletionError] = useState<string | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const onchainAttemptRef = useRef(0);
  const startAbortRef = useRef<AbortController | null>(null);

  const { address, isConnected, isCorrectNetwork, connectWallet, switchToHemi, isConnecting, connectError, isSwitching, switchError } = useWallet();
  const { startRun, error: startError } = useStartRun();
  const { completeRun } = useCompleteRun();

  const resetCompletionState = () => {
    setCompletionData(null);
    setCompletionHash(null);
    setCompletionPhase('idle');
    setCompletionError(null);
  };

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
      connectWallet();
      return;
    }

    if (!isCorrectNetwork) {
      setError(null);
      switchToHemi();
      return;
    }

    resetCompletionState();
    setStatus('starting');
    setStartPhase('entropy');
    setError(null);

    const attempt = ++onchainAttemptRef.current;
    const abortController = new AbortController();
    startAbortRef.current = abortController;
    try {
      console.log('[App] Starting blockchain run...');
      const result = await startRun(0, phase => setStartPhase(phase), abortController.signal);
      if (attempt !== onchainAttemptRef.current) return;
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
      
      setStartPhase('confirmed');
      setStatus('ready');
    } catch (err: any) {
      console.error('[App] Failed to start run:', err);
      if (attempt === onchainAttemptRef.current) {
        setError(startupErrorCopy(err));
        setStatus('idle');
        setStartPhase('idle');
      }
    }
  };

  const beginLocalRun = () => {
    if (status === 'starting' && (startPhase === 'wallet' || startPhase === 'submitted')) {
      setError('A Hemi wallet request or transaction is already active. Reject or wait for it, then start Local safely.');
      return;
    }
    startAbortRef.current?.abort();
    startAbortRef.current = null;
    onchainAttemptRef.current++;
    resetCompletionState();
    setStatus('playing');
    setError(null);
    setStartPhase('idle');
    
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

  const enterConfirmedRun = () => setStatus('playing');

  const handleGameComplete = (finalState: RunState, registry: Phaser.Data.DataManager) => {
    setCompletionHash(null);
    setCompletionPhase('idle');
    setCompletionError(null);
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
    setCompletionHash(null);
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
          const epilogueComplete = gameRef.current?.registry.get('victoryEpilogueComplete') === true;
          if (currentState && (currentState.status === 'won' || currentState.status === 'lost')
            && resultHandoffReady(currentState.status, epilogueComplete)) {
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
    const completionStatus = terminalSubmissionStatus(completionPhase);
    
    return (
      <main className="app-shell">
        <section className="title-card">
          <h1>{runState?.status === 'won' ? 'RUN COMPLETE!' : 'RUN OVER'}</h1>
          {runState?.status === 'won' && <p className="premise">YOU MADE IT OUT. Your nightmare is over. The run remains.</p>}
          <p className="premise">{isBlockchainRun
            ? runState?.status === 'won' ? 'Hemi run complete.' : 'This Hemi run ended before the escape.'
            : 'LOCAL RUN — NO ONCHAIN SUBMISSION REQUIRED'}</p>
          {runState && (
            <div style={{ marginTop: '2rem', color: '#a5b6b5' }}>
              <p>Final Score: {runState.score}</p>
              <p>Blocks Completed: {runState.floorsCompleted}</p>
            </div>
          )}
          {isBlockchainRun && runState?.manifest && (
            <div style={{ marginTop: '1rem', color: '#a5b6b5' }}>
              <p>Run ID: {runState.manifest.runId.toString()}</p>
              <p>Records this run’s result and replay commitment on Hemi.</p>
              {completionPhase === 'confirmed' ? (
                <>
                  <p>CONFIRMED</p>
                  <p>Transaction: {completionHash ? `${completionHash.slice(0, 10)}…${completionHash.slice(-8)}` : 'Confirmed'}</p>
                </>
              ) : (
                <>
                  <p>{completionStatus.label}{completionPhase === 'submitted' && completionHash ? ` ${completionHash.slice(0, 10)}…${completionHash.slice(-8)}` : ''}</p>
                  {completionError && <p role="alert">{completionError}</p>}
                  <button onClick={submitCompletion} disabled={completionStatus.disabled}>{completionStatus.button}</button>
                </>
              )}
              <p>Final score: {runState.score}</p>
            </div>
          )}
          <button onClick={() => window.location.reload()}>NEW RUN</button>
        </section>
      </main>
    );
  }

  const menuActions = runMenuActions(
    isConnected,
    isCorrectNetwork,
    status === 'starting' || isConnecting || isSwitching || status === 'ready',
    status === 'ready',
  );
  const hemiLabel = status === 'starting' && startPhase !== 'idle'
    ? onchainStartupCopy(startPhase as Exclude<MenuStartPhase, 'idle'>)
    : menuActions.hemi === 'enter' ? 'ENTER BLOCK 4'
      : menuActions.hemi === 'busy' ? isConnecting ? 'CONNECTING WALLET…' : isSwitching ? 'SWITCHING TO HEMI…' : 'STARTING HEMI RUN…'
        : menuActions.hemi === 'connect' ? 'CONNECT WALLET FOR HEMI'
          : menuActions.hemi === 'switch-network' ? 'SWITCH TO HEMI TESTNET' : 'PLAY ON HEMI';

  return (
    <main className="app-shell">
      <section className="title-card" aria-labelledby="game-title">
        <p className="eyebrow">HEMI ARCADE // SURVIVAL HORROR</p>
        <h1 id="game-title">BLOCK 13</h1>
        <p className="subtitle">DESCENT INTO DARKNESS</p>
        <p className="premise">A transaction opened a door inside the building. Find the key, descend, and get out before it finds you.</p>

        {status === 'ready' && (
          <div className="run-ready" role="status">
            <p>RUN CONFIRMED ON HEMI</p>
          </div>
        )}

        <div className="run-choices" aria-label="Choose how to play">
          <section className="run-choice">
            <button type="button" className="local-run-button" onClick={beginLocalRun} disabled={!menuActions.localEnabled}>PLAY LOCAL</button>
            <p>{status === 'ready'
              ? 'Play without blockchain. The confirmed Hemi run will remain unfinished.'
              : 'Play now. No wallet or transaction required.'}</p>
          </section>
          <section className="run-choice run-choice-secondary">
            <button type="button" aria-live="polite" onClick={menuActions.hemi === 'enter' ? enterConfirmedRun : beginRun} disabled={menuActions.hemi === 'busy'}>{hemiLabel}</button>
            <p>{status === 'ready'
              ? 'Your run is confirmed on Hemi. Enter Block 4 to begin.'
              : 'Create a run on Hemi, then record your result and replay commitment after the run.'}</p>
          </section>
        </div>

        {isConnected && <p className="run-rule connected-wallet">Connected: {address?.slice(0, 6)}…{address?.slice(-4)}</p>}
        {(error || startError || connectError || switchError) && (
          <p className="menu-error" role="alert">{error || (startError ? startupErrorCopy(startError) : null) || (connectError ? startupErrorCopy(connectError) : null) || (switchError ? startupErrorCopy(switchError) : null)}</p>
        )}
        {status === 'starting' && startPhase !== 'idle' && <span className="sr-only" role="status">{onchainStartupCopy(startPhase as Exclude<MenuStartPhase, 'idle'>)}</span>}
        {isConnected && !isCorrectNetwork && <p className="network-note">PLAY LOCAL is ready now. Hemi runs require Hemi Testnet.</p>}
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
