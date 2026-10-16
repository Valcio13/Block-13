import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RunPreparationToasts } from '../src/components/RunPreparationToasts';
import { emptyRunPreparationStages, updateRunPreparationStage } from '../src/game/runPreparation';

describe('run preparation toast stack', () => {
  it('shows only actual active, most recent completed, and failed pipeline stages', () => {
    let stages = emptyRunPreparationStages();
    stages = updateRunPreparationStage(stages, 'hemi-reference', 'completed');
    stages = updateRunPreparationStage(stages, 'bitcoin-reference', 'completed');
    stages = updateRunPreparationStage(stages, 'ethereum-reference', 'active');
    stages = updateRunPreparationStage(stages, 'hemi-transaction', 'failed');
    const html = renderToStaticMarkup(<RunPreparationToasts stages={stages} visible />);
    expect(html).toContain('Read Bitcoin block data');
    expect(html).toContain('Read Ethereum block data');
    expect(html).toContain('Find the canonical Hemi transaction');
    expect(html).not.toContain('Read confirmed Hemi block data');
    expect((html.match(/class="run-toast /g) ?? []).length).toBe(3);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it('does not render when preparation has ended, leaving countdown and main actions unobstructed', () => {
    expect(renderToStaticMarkup(<RunPreparationToasts stages={emptyRunPreparationStages()} visible={false} />)).toBe('');
  });
});
