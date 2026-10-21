import { describe, expect, it } from 'vitest';
import { getAuthoredClueForSearchId } from './clues';

describe('public narrative naming', () => {
  it('uses Floor 13 in authored clues without changing their stable lookup behavior', () => {
    const clues = Array.from({ length: 18 }, (_, index) => getAuthoredClueForSearchId(`clue_${index}_0_0`));
    expect(clues).toHaveLength(18);
    expect(clues.every(clue => clue !== null && !/Block 13/i.test(clue.content))).toBe(true);
    expect(clues.some(clue => /Floor 13/i.test(clue?.content ?? ''))).toBe(true);
    expect(getAuthoredClueForSearchId('not-a-clue')).toBeNull();
  });

  it('keeps later revelations out of earlier-floor optional notes', () => {
    const early = Array.from({ length: 32 }, (_, index) => getAuthoredClueForSearchId(`clue_4_${index}_0`));
    expect(early.every(clue => !/Floor 13|fire|fatalit|body|whistleblower/i.test(clue?.content ?? ''))).toBe(true);
    const middle = Array.from({ length: 32 }, (_, index) => getAuthoredClueForSearchId(`clue_2_${index}_0`));
    expect(middle.every(clue => !/Floor 13|fatalit|body|whistleblower/i.test(clue?.content ?? ''))).toBe(true);
    const finale = Array.from({ length: 32 }, (_, index) => getAuthoredClueForSearchId(`clue_0_${index}_0`));
    expect(finale.some(clue => /Floor 13/i.test(clue?.content ?? ''))).toBe(true);
  });
});
