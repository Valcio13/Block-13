import { PCG32 } from './pcg32';

export type PuzzleFloor = 4 | 3 | 2 | 1 | 0;
export type PuzzleKind = 'combination' | 'resident' | 'circuit' | 'records' | 'memory';

export interface ResidentCandidate {
  name: string;
  apartment: string;
  hasBicycle: boolean;
  worksNights: boolean;
  maintenanceFloor: number;
}

export interface ProceduralPuzzle {
  floor: PuzzleFloor;
  kind: PuzzleKind;
  title: string;
  deviceLabel: string;
  clueTexts: string[];
  solutionCode?: number[];
  combinationExpressions?: Array<{ left: number; right: number; operator: '+' | '-' | '×' | '÷' }>;
  residents?: ResidentCandidate[];
  correctResident?: number;
  residentClueReferences?: [number, number];
  residentThirdRuleFloor?: number;
  circuitLabels?: string[];
  circuitMask?: number;
  circuitOrder?: number[];
  recordEvents?: string[];
  recordDocuments?: string[];
  recordOrder?: number[];
  memoryFragments?: string[];
  memoryChoices?: string[];
  memoryAnswers?: number[];
}

const RESIDENT_NAMES = ['Mara Venn', 'Elias Rook', 'Nadiya Pell', 'Jonas Vale', 'Iris Morrow'] as const;
const APARTMENTS = ['2A', '3C', '4B', '5D', '6E'] as const;
const CIRCUIT_LABELS = ['LANTERN', 'PAPER', 'HOLLOW', 'NORTH'] as const;
const RECORD_EVENTS = ['MAINTENANCE COMPLAINT', 'SECURITY MEMO', 'INCIDENT REPORT'] as const;
const RECORD_DOCUMENTS = [
  'MAINTENANCE COMPLAINT — Resident reports failing emergency lights and asks management to inspect the wiring. The filing stamp was added later.',
  'SECURITY MEMO — Caretaker notes residents remain inside; emergency exits are locked under a management order citing an unresolved maintenance complaint.',
  'INCIDENT REPORT — Fire reported. The filed copy claims evacuation, but the final page was replaced after the emergency.',
] as const;

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
  const combinationExpressions: Array<{ left: number; right: number; operator: '+' | '-' | '×' | '÷' }> = [];
  const solutionCode: number[] = [];
  const operators = rng.shuffle(['+', '-', '×', '÷'] as const).slice(0, 3);
  for (const operator of operators) {
    let left = 0;
    let right = 0;
    let result = 0;
    if (operator === '+') {
      left = rng.nextRange(2, 9); right = rng.nextRange(2, 9); result = left + right;
    } else if (operator === '-') {
      left = rng.nextRange(3, 9); right = rng.nextRange(1, left - 1); result = left - right;
    } else if (operator === '×') {
      left = rng.nextRange(2, 8); right = rng.nextRange(2, 8); result = left * right;
    } else {
      right = rng.nextRange(2, 8); const quotient = rng.nextRange(2, 8); left = right * quotient; result = quotient;
    }
    const finalDigit = result % 10;
    if (finalDigit === 0) { // Regenerate the current slot without changing the operator mix.
      const fallback = operator === '÷' ? { left: 6, right: 2, result: 3 } : { left: 3, right: 2, result: operator === '×' ? 6 : operator === '+' ? 5 : 1 };
      left = fallback.left; right = fallback.right; result = fallback.result;
    }
    combinationExpressions.push({ left, right, operator });
    solutionCode.push(result % 10);
  }
  const ordinals = ['FIRST', 'SECOND', 'THIRD'];
  const sources = ['CALENDAR', 'PHOTOGRAPH', 'APARTMENT MARK'];
  const narrativeNotes = [
    'The repair schedule has been altered twice. The failure was logged before the repair was ordered.',
    'A maintenance complaint is clipped behind the photograph. Someone removed the reply.',
    'The mark is written beside a vacancy number for a resident the register says never lived here.',
  ];
  return {
    floor: 4, kind: 'combination', title: 'THE LOCKED BOX', deviceLabel: 'MAINTENANCE LOCKBOX', solutionCode,
    clueTexts: solutionCode.map((digit, index) => ({
      title: `${sources[index]} // ${ordinals[index]} DIGIT`,
      content: index === 0
        ? `LOCK CODE // FIRST POSITION\nMarked figures: ${combinationExpressions[index].left} ${combinationExpressions[index].operator} ${combinationExpressions[index].right}. This is the FIRST number in the lock code. Use the ones digit from each marked calculation, in calendar → photograph → apartment-mark order.\n\n${narrativeNotes[index]}`
        : `LOCK CODE // ${ordinals[index]} POSITION\nMarked figures: ${combinationExpressions[index].left} ${combinationExpressions[index].operator} ${combinationExpressions[index].right}. This calculation supplies the ${ordinals[index].toLowerCase()} position.\n\n${narrativeNotes[index]}`,
    })).map(clue => `${clue.title}: ${clue.content}`),
    combinationExpressions,
  };
}

function createResidentDeduction(rng: PCG32): ProceduralPuzzle {
  const otherNames = rng.shuffle([0, 1, 2, 4]);
  const otherApartments = rng.shuffle(['2A', '4B', '5D', '6E']);
  const target = { name: 'Jonas Vale', apartment: '3C', hasBicycle: true, worksNights: true, maintenanceFloor: 3 };
  const distractors = [
    { hasBicycle: true, worksNights: true, maintenanceFloor: 2 },
    { hasBicycle: true, worksNights: false, maintenanceFloor: 3 },
    { hasBicycle: false, worksNights: true, maintenanceFloor: 3 },
    { hasBicycle: false, worksNights: false, maintenanceFloor: 4 },
  ];
  const distractorResidents: ResidentCandidate[] = distractors.map((attributes, index) => ({
    ...attributes, name: RESIDENT_NAMES[otherNames[index]], apartment: otherApartments[index],
  }));
  const residents: ResidentCandidate[] = rng.shuffle([...distractorResidents, target]);
  const correct = residents.findIndex(resident => resident.name === 'Jonas Vale');
  const bicycleReferenceIndex = residents.findIndex((resident, index) => index !== correct && resident.hasBicycle === target.hasBicycle && resident.worksNights === target.worksNights);
  const shiftReferenceIndex = residents.findIndex((resident, index) => index !== correct && resident.worksNights !== target.worksNights && resident.hasBicycle === target.hasBicycle);
  const references: [number, number] = [bicycleReferenceIndex, shiftReferenceIndex];
  const [bicycleReference, shiftReference] = references.map(index => residents[index]);
  return {
    floor: 3, kind: 'resident', title: 'THE MISSING RESIDENT', deviceLabel: 'RESIDENT DIRECTORY',
    residents, correctResident: correct, residentClueReferences: references, residentThirdRuleFloor: target.maintenanceFloor,
    clueTexts: [
      `RULE 1 — BICYCLE: the missing resident has the SAME bicycle status as apartment ${bicycleReference.apartment}.`,
      `RULE 2 — NIGHT SHIFT: the missing resident has the OPPOSITE night-shift status from apartment ${shiftReference.apartment}.`,
      `RULE 3 — MAINTENANCE: the missing resident filed the complaint from the THIRD-FLOOR unit. Apply ALL THREE records to the directory.\n\n“They removed my name from the directory yesterday. I asked the caretaker why. He said nobody had ever lived in my apartment.”`,
    ],
  };
}

function createCircuit(rng: PCG32): ProceduralPuzzle {
  const labels = rng.shuffle([...CIRCUIT_LABELS]);
  const selected = rng.shuffle([0, 1, 2, 3]).slice(0, 2).sort((a, b) => a - b);
  const circuitMask = selected.reduce((mask, index) => mask | (1 << index), 0);
  const circuitOrder = rng.shuffle([...selected]);
  const first = labels[circuitOrder[0]], second = labels[circuitOrder[1]];
  const unused = labels.filter(label => label !== first && label !== second);
  return {
    floor: 2, kind: 'circuit', title: 'THE ARCHIVE CIRCUIT', deviceLabel: 'BREAKER PANEL',
    circuitLabels: labels, circuitMask, circuitOrder,
    clueTexts: [
      `ARCHIVE CIRCUIT DIAGRAM — MAINTENANCE COPY\n\nUPPER RELAY PORT  ── ${first}  ── CLOSED CONNECTION\nLOWER RELAY PORT  ── ${second}  ── CLOSED CONNECTION\nUNUSED FEEDS      - - ${unused[0]} / ${unused[1]} - - OPEN\n\nThe closed lines reach the archive relay. The dashed lines terminate at dead test points.\n\nHANDWRITTEN ADDENDUM: emergency lighting and exit controls were marked DISABLED. The warning was filed, then crossed out.`,
      'MAINTENANCE NOTE // The lower relay connection stabilized only after the upper connection had been engaged. Restore the stable connection first, then the one it enabled. Do not restore the panel without recording who ordered the change.',
    ],
  };
}

function createRecords(rng: PCG32): ProceduralPuzzle {
  const events = rng.shuffle([...RECORD_EVENTS]);
  const recordOrder = [events.indexOf('MAINTENANCE COMPLAINT'), events.indexOf('SECURITY MEMO'), events.indexOf('INCIDENT REPORT')];
  const maintenance = events[recordOrder[0]], security = events[recordOrder[1]], incident = events[recordOrder[2]];
  const recordDocuments = events.map(event => RECORD_DOCUMENTS[RECORD_EVENTS.indexOf(event as typeof RECORD_EVENTS[number])]);
  return {
    floor: 1, kind: 'records', title: 'THE CONTRADICTORY RECORDS', deviceLabel: 'ARCHIVE INDEX',
    recordEvents: events, recordDocuments, recordOrder,
    clueTexts: [
      `${maintenance}\n\n${recordDocuments[recordOrder[0]]}\n\nRECOVERED REFERENCE — This complaint is the fault later cited by the ${security}.`,
      `${security}\n\n${recordDocuments[recordOrder[1]]}\n\nSECURITY MARGIN NOTE — These exits were locked before the ${incident} occurred.`,
      'ARCHIVE STAMP — Filing times were altered after the emergency. Reconstruct the occurrence order from the document relationships, not the stamps.',
    ],
  };
}

function createMemory(rng: PCG32, worldSeed: number): ProceduralPuzzle {
  const floor4 = generateProceduralPuzzle(worldSeed, 4);
  const floor3 = generateProceduralPuzzle(worldSeed, 3);
  const residents = floor3.residents!;
  const missingResident = residents[floor3.correctResident!];
  const memoryFragments = [
    'A PHOTOGRAPH WITH A TORN EDGE. SOMEONE WROTE: “GO TO THE FOURTH FLOOR.”',
    `A DIRECTORY LINE SCRAPED AWAY: ${missingResident.name} / ${missingResident.apartment}. THE VACANCY WAS A LIE.`,
    'A MAINTENANCE NOTE IN AN UNFAMILIAR HAND: KEEP THE EXITS OPEN.',
  ];
  const memoryChoices = rng.shuffle(['THE FIRST WARNING — FLOOR 4', 'THE ERASED DIRECTORY — FLOOR 3', 'THE LAST RECORD — FLOOR 1']);
  const correctChoiceFor = [
    'THE FIRST WARNING — FLOOR 4', 'THE ERASED DIRECTORY — FLOOR 3', 'THE LAST RECORD — FLOOR 1',
  ];
  const memoryAnswers = correctChoiceFor.map(choice => memoryChoices.indexOf(choice));
  return {
    floor: 0, kind: 'memory', title: 'THE FINAL MEMORY', deviceLabel: 'ARCHIVE RECONSTRUCTION',
    memoryFragments, memoryChoices, memoryAnswers,
    clueTexts: [
      `The anonymous message names the photograph, not its sender. The code ${floor4.solutionCode!.join('')} is written on the same torn edge.`,
      `The erased resident was ${missingResident.name}, apartment ${missingResident.apartment}. The record repeats the whistleblower's signature beside the removed entry.`,
      'FINAL RULE: match each recovered memory to the floor it remembers. Use each floor once, then confirm each association. The sender remains unnamed. The last message was written from behind a locked door.',
    ],
  };
}

/** Exhaustive generation-time invariant check, also used by the seed tests. */
export function validateProceduralPuzzle(puzzle: ProceduralPuzzle): boolean {
  switch (puzzle.kind) {
    case 'combination':
      return puzzle.solutionCode?.length === 3 && puzzle.solutionCode.every(digit => digit >= 1 && digit <= 9)
        && puzzle.combinationExpressions?.length === 3
        && puzzle.combinationExpressions.every((expression, index) => {
          const result = expression.operator === '+' ? (expression.left + expression.right) % 10
            : expression.operator === '-' ? (expression.left - expression.right + 10) % 10
              : expression.operator === '×' ? (expression.left * expression.right) % 10
                : expression.right !== 0 && expression.left % expression.right === 0 ? (expression.left / expression.right) % 10 : -1;
          return expression.left >= 1 && expression.right >= 1
            && (expression.operator !== '-' || expression.left >= expression.right)
            && (expression.operator !== '÷' || expression.left % expression.right === 0)
            && result >= 1
            && result === puzzle.solutionCode![index]
            && puzzle.clueTexts[index].includes(`${['FIRST', 'SECOND', 'THIRD'][index]} DIGIT`)
            && puzzle.clueTexts[index].includes(`${expression.left} ${expression.operator} ${expression.right}`);
        });
    case 'resident': {
      if (!puzzle.residents || puzzle.residents.length !== 5 || puzzle.clueTexts.length !== 3) return false;
      if (new Set(puzzle.residents.map(resident => resident.apartment)).size !== 5) return false;
      const refs = puzzle.residentClueReferences;
      const target = puzzle.correctResident;
      if (target === undefined || !puzzle.residents[target] || !refs || refs.length !== 2
        || refs.some(index => !puzzle.residents![index] || index === target) || refs[0] === refs[1]) return false;
      const [bicycleReference, shiftReference] = refs.map(index => puzzle.residents![index]);
      const matches = puzzle.residents.filter(candidate => candidate.hasBicycle === bicycleReference.hasBicycle
        && candidate.worksNights !== shiftReference.worksNights
        && candidate.maintenanceFloor === puzzle.residentThirdRuleFloor);
      return matches.length === 1 && matches[0] === puzzle.residents[target]
        && puzzle.residentThirdRuleFloor === 3
        && refs.every((index, clueIndex) => puzzle.clueTexts[clueIndex].includes(puzzle.residents![index].apartment))
        && puzzle.clueTexts[2].includes('THIRD-FLOOR');
    }
    case 'circuit':
      if (!puzzle.circuitLabels || puzzle.circuitLabels.length !== 4) return false;
      return new Set(puzzle.circuitLabels).size === 4
        && puzzle.circuitMask !== undefined && puzzle.circuitMask > 0 && puzzle.circuitMask < (1 << puzzle.circuitLabels.length)
        && !!puzzle.circuitOrder && puzzle.circuitOrder.length === 2 && new Set(puzzle.circuitOrder).size === 2
        && puzzle.circuitOrder.every(index => index >= 0 && index < puzzle.circuitLabels!.length)
        && puzzle.circuitOrder.every(index => (puzzle.circuitMask! & (1 << index)) !== 0)
        && puzzle.clueTexts.length === 2
        && puzzle.circuitLabels.filter((_, index) => (puzzle.circuitMask! & (1 << index)) !== 0).length === 2
        && puzzle.circuitLabels.filter((_, index) => (puzzle.circuitMask! & (1 << index)) !== 0)
          .every(label => puzzle.clueTexts[0].includes(label))
        && puzzle.clueTexts[1].includes('stabilized');
    case 'records':
      if (!puzzle.recordEvents || puzzle.recordEvents.length !== 3 || new Set(puzzle.recordEvents).size !== 3
        || !puzzle.recordDocuments || puzzle.recordDocuments.length !== 3
        || !puzzle.recordOrder || puzzle.recordOrder.length !== 3 || new Set(puzzle.recordOrder).size !== 3
        || puzzle.recordOrder.some(index => index < 0 || index >= 3)
        || puzzle.clueTexts.length !== 3) return false;
      const events = puzzle.recordEvents;
      const [first, middle, last] = puzzle.recordOrder.map(index => events[index]);
      return first === 'MAINTENANCE COMPLAINT' && middle === 'SECURITY MEMO' && last === 'INCIDENT REPORT'
        && puzzle.clueTexts[0].includes(first) && puzzle.clueTexts[0].includes(middle)
        && puzzle.clueTexts[1].includes(middle) && puzzle.clueTexts[1].includes(last)
        && puzzle.clueTexts[2].includes('occurrence order');
    case 'memory':
      return !!puzzle.memoryFragments && puzzle.memoryFragments.length === 3
        && !!puzzle.memoryChoices && puzzle.memoryChoices.length === 3
        && new Set(puzzle.memoryChoices).size === 3
        && !!puzzle.memoryAnswers && puzzle.memoryAnswers.length === 3
        && puzzle.memoryAnswers.every((answer, index) => answer >= 0 && answer < 3 && puzzle.memoryChoices![answer] !== undefined)
        && new Set(puzzle.memoryAnswers).size === 3
        && puzzle.clueTexts.length === 3;
  }
}
