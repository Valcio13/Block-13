import { PCG32 } from './pcg32';

export type PuzzleFloor = 4 | 3 | 2 | 1 | 0;
export type PuzzleKind = 'combination' | 'resident' | 'circuit' | 'records' | 'memory';

export interface ResidentCandidate {
  name: string;
  apartment: string;
  hasBicycle: boolean;
  worksNights: boolean;
}

export interface ProceduralPuzzle {
  floor: PuzzleFloor;
  kind: PuzzleKind;
  title: string;
  deviceLabel: string;
  clueTexts: string[];
  solutionCode?: number[];
  combinationExpressions?: Array<{ left: number; right: number; operator: '+' | '-' | '×' }>;
  residents?: ResidentCandidate[];
  correctResident?: number;
  residentClueReferences?: [number, number];
  circuitLabels?: string[];
  circuitMask?: number;
  circuitOrder?: number[];
  recordEvents?: string[];
  recordOrder?: number[];
  memoryFragments?: string[];
  memoryChoices?: string[];
  memoryAnswers?: number[];
}

const RESIDENT_NAMES = ['Mara Venn', 'Elias Rook', 'Nadiya Pell', 'Jonas Vale'] as const;
const APARTMENTS = ['2A', '3C', '4B', '5D'] as const;
const CIRCUIT_LABELS = ['LANTERN', 'PAPER', 'HOLLOW', 'NORTH'] as const;
const RECORD_EVENTS = ['The tenant register was sealed', 'The stairwell was inspected', 'The building vanished from the city index'] as const;

/**
 * Puzzle RNG is domain-separated from the map, loot, enemy, and presentation
 * streams. It is derived only from the canonical low 32-bit world seed and
 * floor number, so puzzle generation cannot shift any existing RNG sequence.
 */
export function generateProceduralPuzzle(worldSeed: number, floor: PuzzleFloor): ProceduralPuzzle {
  const floorSalt = BigInt(floor + 1) * 0x9e3779b97f4a7c15n;
  const seed = (BigInt(worldSeed >>> 0) ^ 0x50555a5a4c453031n ^ floorSalt) & 0xffff_ffff_ffff_ffffn;
  const rng = new PCG32(seed, 0x50555a5a4c45n);
  switch (floor) {
    case 4: return createCombination(rng);
    case 3: return createResidentDeduction(rng);
    case 2: return createCircuit(rng);
    case 1: return createRecords(rng);
    case 0: return createMemory(rng, worldSeed);
  }
}

function createCombination(rng: PCG32): ProceduralPuzzle {
  const combinationExpressions: Array<{ left: number; right: number; operator: '+' | '-' | '×' }> = Array.from({ length: 3 }, () => {
    const left = rng.nextRange(1, 9);
    const right = rng.nextRange(1, 9);
    const operator: '+' | '-' | '×' = rng.nextRange(0, 2) === 0 ? '+' : rng.nextRange(0, 1) === 0 ? '-' : '×';
    return { left, right, operator };
  });
  const solutionCode = combinationExpressions.map(({ left, right, operator }) =>
    operator === '+' ? (left + right) % 10 : operator === '-' ? (left - right + 10) % 10 : (left * right) % 10);
  const ordinals = ['FIRST', 'SECOND', 'THIRD'];
  const sources = ['CALENDAR', 'PHOTOGRAPH', 'APARTMENT MARK'];
  return {
    floor: 4, kind: 'combination', title: 'THE LOCKED BOX', deviceLabel: 'MAINTENANCE LOCKBOX', solutionCode,
    clueTexts: solutionCode.map((digit, index) => ({
      title: `${sources[index]} // ${ordinals[index]} DIGIT`,
      content: `The ${sources[index].toLowerCase()} records ${combinationExpressions[index].left} ${combinationExpressions[index].operator} ${combinationExpressions[index].right}. Reduce the result to the final digit; this is the ${ordinals[index]} number.`,
    })).map(clue => `${clue.title}: ${clue.content}`),
    combinationExpressions,
  };
}

function createResidentDeduction(rng: PCG32): ProceduralPuzzle {
  const target = rng.nextRange(0, 3);
  const patterns = rng.shuffle([0, 1, 2, 3]);
  const nameOrder = rng.shuffle([0, 1, 2, 3]);
  const residents = patterns.map((pattern, index) => ({
    name: RESIDENT_NAMES[nameOrder[index]],
    apartment: APARTMENTS[(nameOrder[index] + rng.nextRange(0, 3)) % 4],
    hasBicycle: (pattern & 1) !== 0,
    worksNights: (pattern & 2) !== 0,
  }));
  const correct = residents.findIndex(resident => resident.hasBicycle === residents[target].hasBicycle
    && resident.worksNights === residents[target].worksNights);
  const targetResident = residents[correct];
  const bicycleReferences = residents.map((resident, index) => ({ resident, index }))
    .filter(({ resident, index }) => index !== correct && resident.hasBicycle === targetResident.hasBicycle);
  const bicycleReferenceIndex = bicycleReferences[rng.nextRange(0, bicycleReferences.length - 1)].index;
  const shiftReferences = residents.map((resident, index) => ({ resident, index }))
    .filter(({ resident, index }) => index !== correct && index !== bicycleReferenceIndex && resident.worksNights !== targetResident.worksNights);
  const shiftReferenceIndex = shiftReferences[rng.nextRange(0, shiftReferences.length - 1)].index;
  const references: [number, number] = [bicycleReferenceIndex, shiftReferenceIndex];
  const [bicycleReference, shiftReference] = references.map(index => residents[index]);
  return {
    floor: 3, kind: 'resident', title: 'THE MISSING RESIDENT', deviceLabel: 'RESIDENT DIRECTORY',
    residents, correctResident: correct, residentClueReferences: references,
    clueTexts: [
      `A bicycle receipt is linked to apartment ${bicycleReference.apartment}. The missing resident had the same bicycle status as that tenant.`,
      `The missing resident's shift was opposite the rota entry for apartment ${shiftReference.apartment}. Compare both records with the directory.`,
    ],
  };
}

function createCircuit(rng: PCG32): ProceduralPuzzle {
  const labels = rng.shuffle([...CIRCUIT_LABELS]);
  const selected = rng.shuffle([0, 1, 2, 3]).slice(0, 2).sort((a, b) => a - b);
  const circuitMask = selected.reduce((mask, index) => mask | (1 << index), 0);
  const circuitOrder = rng.shuffle([...selected]);
  return {
    floor: 2, kind: 'circuit', title: 'THE ARCHIVE CIRCUIT', deviceLabel: 'BREAKER PANEL',
    circuitLabels: labels, circuitMask, circuitOrder,
    clueTexts: [`MAINTENANCE DIAGRAM: the ARCHIVE relay accepts two feeds in sequence. Trace ${labels[circuitOrder[0]]} first, then ${labels[circuitOrder[1]]}. Leave every other breaker disconnected.`],
  };
}

function createRecords(rng: PCG32): ProceduralPuzzle {
  const recordOrder = rng.shuffle([0, 1, 2]);
  const events = rng.shuffle([...RECORD_EVENTS]);
  // The two chained comparisons uniquely establish the full three-event order.
  const first = events[recordOrder[0]], middle = events[recordOrder[1]], last = events[recordOrder[2]];
  return {
    floor: 1, kind: 'records', title: 'THE CONTRADICTORY RECORDS', deviceLabel: 'ARCHIVE INDEX',
    recordEvents: events, recordOrder,
    clueTexts: [
      `REGISTRY MARGIN: “${first}” occurred before “${middle}.”`,
      `EVACUATION REPORT: “${middle}” occurred before “${last}.”`,
      `A final note confirms these three entries belong to the same night; the official index is the altered copy.`,
    ],
  };
}

function createMemory(rng: PCG32, worldSeed: number): ProceduralPuzzle {
  const floor4 = generateProceduralPuzzle(worldSeed, 4);
  const floor3 = generateProceduralPuzzle(worldSeed, 3);
  const residents = floor3.residents!;
  const missingResident = residents[floor3.correctResident!];
  const memoryFragments = [
    'THE MESSAGE HAD NO SENDER',
    `THE ERASED NAME: ${missingResident.name} / ${missingResident.apartment}`,
    `YOUR HANDWRITING IN THE SEALED RECORD`,
  ];
  const memoryChoices = rng.shuffle(['THE VISIT — FLOOR 4', 'THE MISSING RESIDENT — FLOOR 3', 'THE SEALED RECORD — FLOOR 1']);
  const correctChoiceFor = [
    'THE VISIT — FLOOR 4', 'THE MISSING RESIDENT — FLOOR 3', 'THE SEALED RECORD — FLOOR 1',
  ];
  const memoryAnswers = correctChoiceFor.map(choice => memoryChoices.indexOf(choice));
  return {
    floor: 0, kind: 'memory', title: 'THE FINAL MEMORY', deviceLabel: 'ARCHIVE RECONSTRUCTION',
    memoryFragments, memoryChoices, memoryAnswers,
    clueTexts: [
      `The anonymous message names the photograph, not its sender. The code ${floor4.solutionCode!.join('')} is written on the same torn edge.`,
      `The erased resident was ${missingResident.name}, apartment ${missingResident.apartment}. The record repeats a signature in your handwriting.`,
      'One final fragment is missing: the person who sent the message was already inside the photograph.',
    ],
  };
}

/** Exhaustive generation-time invariant check, also used by the seed tests. */
export function validateProceduralPuzzle(puzzle: ProceduralPuzzle): boolean {
  switch (puzzle.kind) {
    case 'combination':
      return puzzle.solutionCode?.length === 3 && puzzle.solutionCode.every(digit => digit >= 0 && digit <= 9)
        && puzzle.combinationExpressions?.length === 3
        && puzzle.combinationExpressions.every((expression, index) => {
          const result = expression.operator === '+' ? (expression.left + expression.right) % 10
            : expression.operator === '-' ? (expression.left - expression.right + 10) % 10
              : (expression.left * expression.right) % 10;
          return expression.left >= 1 && expression.left <= 9 && expression.right >= 1 && expression.right <= 9
            && result === puzzle.solutionCode![index]
            && puzzle.clueTexts[index].includes(`${['FIRST', 'SECOND', 'THIRD'][index]} DIGIT`);
        });
    case 'resident': {
      if (!puzzle.residents || puzzle.residents.length !== 4 || puzzle.clueTexts.length !== 2) return false;
      const refs = puzzle.residentClueReferences;
      const target = puzzle.correctResident;
      if (target === undefined || !puzzle.residents[target] || !refs || refs.length !== 2
        || refs.some(index => !puzzle.residents![index] || index === target) || refs[0] === refs[1]) return false;
      const [bicycleReference, shiftReference] = refs.map(index => puzzle.residents![index]);
      const matches = puzzle.residents.filter(candidate => candidate.hasBicycle === bicycleReference.hasBicycle
        && candidate.worksNights !== shiftReference.worksNights);
      return matches.length === 1 && matches[0] === puzzle.residents[target]
        && refs.every((index, clueIndex) => puzzle.clueTexts[clueIndex].includes(puzzle.residents![index].apartment));
    }
    case 'circuit':
      if (!puzzle.circuitLabels || puzzle.circuitLabels.length !== 4) return false;
      return new Set(puzzle.circuitLabels).size === 4
        && puzzle.circuitMask !== undefined && puzzle.circuitMask > 0 && puzzle.circuitMask < (1 << puzzle.circuitLabels.length)
        && !!puzzle.circuitOrder && puzzle.circuitOrder.length === 2 && new Set(puzzle.circuitOrder).size === 2
        && puzzle.circuitOrder.every(index => index >= 0 && index < puzzle.circuitLabels!.length)
        && puzzle.circuitOrder.every(index => (puzzle.circuitMask! & (1 << index)) !== 0)
        && puzzle.clueTexts.length === 1
        && puzzle.circuitLabels.filter((_, index) => (puzzle.circuitMask! & (1 << index)) !== 0).length === 2
        && puzzle.circuitLabels.filter((_, index) => (puzzle.circuitMask! & (1 << index)) !== 0)
          .every(label => puzzle.clueTexts[0].includes(label));
    case 'records':
      return !!puzzle.recordEvents && puzzle.recordEvents.length === 3 && new Set(puzzle.recordEvents).size === 3
        && !!puzzle.recordOrder && puzzle.recordOrder.length === 3
        && puzzle.recordOrder.every(index => index >= 0 && index < puzzle.recordEvents!.length)
        && new Set(puzzle.recordOrder).size === 3
        && puzzle.clueTexts.length === 3 && puzzle.recordOrder[0] !== puzzle.recordOrder[1]
        && puzzle.recordOrder[1] !== puzzle.recordOrder[2] && puzzle.recordOrder[0] !== puzzle.recordOrder[2];
    case 'memory':
      return !!puzzle.memoryFragments && puzzle.memoryFragments.length === 3
        && !!puzzle.memoryChoices && puzzle.memoryChoices.length === 3
        && !!puzzle.memoryAnswers && puzzle.memoryAnswers.length === 3
        && puzzle.memoryAnswers.every((answer, index) => answer >= 0 && answer < 3 && puzzle.memoryChoices![answer] !== undefined)
        && puzzle.clueTexts.length === 3;
  }
}
