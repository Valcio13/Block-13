import { useState, useRef, useEffect } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from './game/config';
import { createRun } from './core/run';
import type { RunState } from './core/run';

type RunStatus = 'idle' | 'starting' | 'playing';

export default function App() {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [runState, setRunState] = useState<RunState | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  const beginRun = () => {
    setStatus('starting');
    // Create run with timestamp seed for deterministic generation
    const seed = Date.now();
    const newRun = createRun(seed);
    setRunState(newRun);
    
    window.setTimeout(() => {
      setStatus('playing');
    }, 450);
  };

  useEffect(() => {
    if (status === 'playing' && gameContainerRef.current && !gameRef.current && runState) {
      // Create Phaser game instance with run state
      const config = createGameConfig('game-container', runState);
      gameRef.current = new Phaser.Game(config);
    }

    // Cleanup on unmount
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
        <button type="button" onClick={beginRun} disabled={status === 'starting'}>
          {status === 'idle' && 'START RUN'}
          {status === 'starting' && 'CREATING SEED…'}
        </button>
        <p className="run-rule">2 transactions only: start run · submit score</p>
      </section>
    </main>
  );
}
