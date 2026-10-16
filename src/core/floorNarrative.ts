export interface ObjectiveClue {
  title: string;
  content: string;
}

const OBJECTIVE_CLUES: Readonly<Record<number, readonly ObjectiveClue[]>> = {
  4: [{ title: 'THE OLD PHOTOGRAPH', content: 'The stairwell behind the residents is the one from the message. Someone scratched out the face beside you. On the back: “Fourth floor. You need to see this.”' }],
  3: [
    { title: 'THE RESIDENT REGISTER', content: 'A name has been cut from every copy. The room number remains: 3B. The entry is dated years after the building vanished from the records.' },
    { title: 'THE FAMILY PHOTOGRAPH', content: 'The person missing from the register stands beside you. You recognize the coat. You do not remember taking this picture.' },
  ],
  2: [
    { title: 'THE SERVICE FUSE', content: 'The label is written in two hands. One says ARCHIVE. The other says DO NOT RESTORE.' },
    { title: 'THE ARCHIVE TERMINAL', content: 'The terminal lists every erased address in the building. One file is still open under your name.' },
  ],
  1: [
    { title: 'THE SEALED RECORD', content: 'The file records a resident who was never born, never moved in, and never left. The signature at the bottom is yours.' },
    { title: 'THE ACCESS NOTE', content: '“If you have reached the ground floor, do not open the street door.” The handwriting matches the message.' },
  ],
  0: [{ title: 'THE FINAL MEMORY', content: 'The photograph is from before the building disappeared. You are in it, standing beside the person whose face was erased.' }],
};

export function objectiveClueAt(floor: number, step: number): ObjectiveClue | undefined {
  if (!Number.isInteger(step) || step < 0) return undefined;
  return OBJECTIVE_CLUES[floor]?.[step];
}
