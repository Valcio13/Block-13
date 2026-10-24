import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { generateProceduralPuzzle } from '../src/core/proceduralPuzzles';
import { memoryFragmentDisplay, recordsMayBeCompared } from '../src/game/puzzlePresentation';

const floorScene = readFileSync(new URL('../src/game/scenes/FloorScene.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

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

  it('keeps the final notebook rule procedural without revealing associations', () => {
    const puzzle = generateProceduralPuzzle(0x44bb, 0);
    expect(puzzle.clueTexts[2]).toContain('match each recovered memory to the floor it remembers');
    expect(puzzle.clueTexts[2]).toContain('Use each floor once');
    expect(puzzle.clueTexts[2]).not.toContain('FLOOR 4');
    expect(puzzle.clueTexts[2]).not.toContain('FLOOR 3');
    expect(puzzle.clueTexts[2]).not.toContain('FLOOR 1');
  });

  it('keeps Floor 4 calculations in the notebook instead of the lock panel', () => {
    const panel = floorScene.slice(floorScene.indexOf("if (puzzle.kind === 'combination')"), floorScene.indexOf("} else if (puzzle.kind === 'resident')"));
    expect(panel).toContain('CALENDAR');
    expect(panel).toContain('PHOTOGRAPH');
    expect(panel).toContain('APARTMENT MARK');
    expect(panel).not.toContain('expression.left');
    expect(panel).not.toContain('expression.right');
  });
});
