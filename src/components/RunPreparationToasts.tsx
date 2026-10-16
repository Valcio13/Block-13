import { RUN_PREPARATION_STAGES, type RunPreparationStages } from '../game/runPreparation';

/** Compact, event-driven run preparation feedback; no synthetic progress. */
export function RunPreparationToasts({ stages, visible }: { stages: RunPreparationStages; visible: boolean }) {
  if (!visible) return null;
  const entries = RUN_PREPARATION_STAGES.map(stage => ({ ...stage, status: stages[stage.id] }))
    .filter(stage => stage.status !== 'pending');
  const active = entries.find(stage => stage.status === 'active');
  const failed = entries.filter(stage => stage.status === 'failed');
  const completed = entries.filter(stage => stage.status === 'completed').slice(-1);
  const shown = [...failed, ...(active ? [active] : []), ...completed].slice(-3);
  const announcement = failed.at(-1) ?? active;
  return <>
    <aside className="run-toast-stack" aria-label="Run preparation updates">
      {shown.map(stage => <div key={stage.id} className={`run-toast is-${stage.status}`}>
        <span className="run-toast-icon" aria-hidden="true">{stage.status === 'completed' ? '✓' : stage.status === 'failed' ? '!' : '◌'}</span>
        <span>{stage.label}</span>
      </div>)}
    </aside>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {announcement ? `${announcement.status}: ${announcement.label}` : ''}
    </span>
  </>;
}
