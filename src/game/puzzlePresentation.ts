import type { ProceduralPuzzle } from '../core/proceduralPuzzles';

/** Keep locked content absent from the UI until its evidence is confirmed. */
export function recordsMayBeCompared(puzzle: ProceduralPuzzle, discoveredSteps: ReadonlySet<number>): boolean {
  return puzzle.kind === 'records' && puzzle.clueTexts.every((_, index) => discoveredSteps.has(index));
}

export function memoryFragmentDisplay(fragment: string, choice: string, index: number, discoveredSteps: ReadonlySet<number>): string {
  if (!discoveredSteps.has(index)) return `FRAGMENT ${String(index + 1).padStart(2, '0')}  ·  NOT RECOVERED`;
  return `${fragment} → ${choice}`;
}
