import { describe, expect, it } from 'vitest';
import { generateProceduralPuzzle } from '../src/core/proceduralPuzzles';
import { memoryFragmentDisplay, recordsMayBeCompared } from '../src/game/puzzlePresentation';

describe('evidence-gated puzzle presentation', () => {
  it('keeps Floor 1 record choices hidden until every supporting record is found', () => {
    const puzzle = generateProceduralPuzzle(0x33aa, 1);
    expect(recordsMayBeCompared(puzzle, new Set())).toBe(false);
    expect(recordsMayBeCompared(puzzle, new Set([0, 1]))).toBe(false);
    expect(recordsMayBeCompared(puzzle, new Set([0, 1, 2]))).toBe(true);
  });

  it('does not render unrecovered Floor 13 memory text or association', () => {
    const puzzle = generateProceduralPuzzle(0x44bb, 0);
    const hidden = memoryFragmentDisplay(puzzle.memoryFragments![1], puzzle.memoryChoices![puzzle.memoryAnswers![1]], 1, new Set());
    expect(hidden).toBe('FRAGMENT 02  ·  NOT RECOVERED');
    expect(hidden).not.toContain(puzzle.memoryFragments![1]);
    expect(hidden).not.toContain(puzzle.memoryChoices![puzzle.memoryAnswers![1]]);
    const found = memoryFragmentDisplay(puzzle.memoryFragments![1], puzzle.memoryChoices![0], 1, new Set([1]));
    expect(found).toContain(puzzle.memoryFragments![1]);
  });
});
