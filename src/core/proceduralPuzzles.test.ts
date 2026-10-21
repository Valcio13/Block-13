import { describe, expect, it } from 'vitest';
import { generateFloor } from './floor';
import { generateProceduralPuzzle, validateProceduralPuzzle } from './proceduralPuzzles';

function reachable(floor: ReturnType<typeof generateFloor>, destination: [number, number]): boolean {
  const queue: Array<[number, number]> = [floor.start];
  const visited = new Set([`${floor.start[0]},${floor.start[1]}`]);
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head];
    if (x === destination[0] && y === destination[1]) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
      if (floor.tiles[ny]?.[nx] && !visited.has(key)) { visited.add(key); queue.push([nx, ny]); }
    }
  }
  return false;
}

describe('procedural floor puzzles', () => {
  it('is seed-stable, domain-separated by floor, and produces meaningful variation', () => {
    for (const floor of [4, 3, 2, 1, 0] as const) {
      const a = generateProceduralPuzzle(712345, floor);
      expect(generateProceduralPuzzle(712345, floor)).toEqual(a);
      expect(validateProceduralPuzzle(a)).toBe(true);
      expect(generateProceduralPuzzle(712346, floor)).not.toEqual(a);
    }
  });

  it('makes the Floor 3 resident answer require cross-referencing both records', () => {
    for (let seed = 0; seed < 512; seed++) {
      const puzzle = generateProceduralPuzzle(seed, 3);
      expect(validateProceduralPuzzle(puzzle)).toBe(true);
      const residents = puzzle.residents!;
      const [bicycleReferenceIndex, shiftReferenceIndex] = puzzle.residentClueReferences!;
      const bicycleReference = residents[bicycleReferenceIndex];
      const shiftReference = residents[shiftReferenceIndex];
      const matchingResidents = residents.filter(candidate => candidate.hasBicycle === bicycleReference.hasBicycle
        && candidate.worksNights !== shiftReference.worksNights);
      expect(matchingResidents).toEqual([residents[puzzle.correctResident!]]);
      expect(puzzle.clueTexts[0]).toContain(bicycleReference.apartment);
      expect(puzzle.clueTexts[1]).toContain(shiftReference.apartment);
      expect(puzzle.clueTexts.join(' ')).not.toMatch(/missing resident (kept|did not keep|worked|never worked)/i);
    }
  });

  it('keeps the Floor 4 code behind deterministic arithmetic clues and gives Floor 2 an activation order', () => {
    for (const seed of [0, 1, 17, 0x7fffffff]) {
      const combination = generateProceduralPuzzle(seed, 4);
      expect(combination.combinationExpressions).toHaveLength(3);
      expect(combination.solutionCode).toHaveLength(3);
      expect(combination.solutionCode!.every(digit => digit >= 1 && digit <= 9)).toBe(true);
      combination.combinationExpressions!.forEach(expression => {
        if (expression.operator === '-') expect(expression.left).toBeGreaterThanOrEqual(expression.right);
      });
      expect(combination.clueTexts.join(' ')).not.toMatch(/records?\s+\d+\s+.*\s*=\s*\d/i);
      const circuit = generateProceduralPuzzle(seed, 2);
      expect(circuit.circuitOrder).toHaveLength(2);
      expect(new Set(circuit.circuitOrder)).toEqual(new Set(circuit.circuitLabels!.map((_, index) => index).filter(index => circuit.circuitMask! & (1 << index))));
      expect(circuit.clueTexts[0]).toContain('in sequence');
    }
  });

  it('validates puzzle clues and reachable device/evidence/fallback placement over a deterministic seed sample', () => {
    const seeds = [...Array.from({ length: 512 }, (_, seed) => seed), 0x7fffffff, 0xffffffff];
    for (const seed of seeds) for (const floorNumber of [4, 3, 2, 1, 0]) {
      const floor = generateFloor(seed, floorNumber);
      expect(validateProceduralPuzzle(floor.puzzle), `puzzle seed ${seed}, floor ${floorNumber}`).toBe(true);
      expect(reachable(floor, floor.puzzleDevice), `device seed ${seed}, floor ${floorNumber}`).toBe(true);
      for (const index of floor.objectives.searchableIndices) {
        const item = floor.searchables[index];
        expect(reachable(floor, [item.x, item.y]), `clue seed ${seed}, floor ${floorNumber}`).toBe(true);
      }
      if (floor.puzzleFallbackSite) expect(reachable(floor, floor.puzzleFallbackSite)).toBe(true);
    }
  }, 15_000);
});
