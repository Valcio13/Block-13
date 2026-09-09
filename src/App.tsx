import { useState } from 'react';

type RunStatus = 'idle' | 'starting' | 'ready';

export default function App() {
  const [status, setStatus] = useState<RunStatus>('idle');

  const beginRun = () => {
    setStatus('starting');
    window.setTimeout(() => setStatus('ready'), 450);
  };

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
          {status === 'ready' && 'RUN READY — GAME SCENE NEXT'}
        </button>
        <p className="run-rule">2 transactions only: start run · submit score</p>
      </section>
    </main>
  );
}
