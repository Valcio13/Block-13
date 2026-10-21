import { SeededRng } from './rng';

export interface Clue {
  id: string;
  title: string;
  content: string;
}

/** Earliest progression floor on which an optional note may appear. The
 * numeric floor IDs descend toward Floor 13 (0), so later revelations use a
 * lower threshold and cannot surface during earlier investigations. */
const CLUE_REVEAL_FLOOR: Record<string, number> = {
  missing_tenants: 4,
  elevator_log: 4,
  security_incident: 4,
  previous_resident: 4,
  contractor_warning: 2,
  box_warning: 4,
  emergency_exit: 2,
  something_below: 2,
  light_behavior: 4,
  outside_doesnt_exist: 1,
  wall_observation: 4,
  box_instructions: 4,
  floor_thirteen: 0,
  resident_408: 0,
  corrupted_log: 3,
  research_fragment: 0,
  janitor_recording: 0,
  warning_scrawl: 4,
};

// 18 authored horror story fragments for Block 13 (mix of complete and fragmented)
const ALL_CLUES: Clue[] = [
  {
    id: 'missing_tenants',
    title: 'REDEVELOPMENT MEMO',
    content: 'Property value review: several long-term tenants refuse to leave. Recommend continued pressure through delayed repairs and revised vacancy notices. Do not circulate outside management.',
  },
  {
    id: 'elevator_log',
    title: 'ELECTRICAL MAINTENANCE LOG',
    content: 'Technician note: emergency circuits failed again after the scheduled repair. The replacement order was marked complete before anyone inspected the panel. Resident complaints attached. Recommended: do not close this ticket.',
  },
  {
    id: 'security_incident',
    title: 'CARETAKER REPORT',
    content: 'Night shift: resident from the fourth floor returned with another photograph of the failed lights. I was told to remove the complaint from the folder. The request was not empty. I signed nothing.',
  },
  {
    id: 'previous_resident',
    title: 'RESIDENT COMPLAINT',
    content: 'Fourth-floor lights failed three times this week. The exit sign was removed during the repair and never returned. Management says the building is safe. The maintenance log says otherwise.',
  },
  {
    id: 'contractor_warning',
    title: 'CONTRACTOR MEMO',
    content: 'Do not sign off on the emergency-exit work. The locks are being replaced with hardware that cannot be opened from the stairwell. Management says the change is temporary. It is not on the approved plan.',
  },
  {
    id: 'box_warning',
    title: 'SCRAWLED MESSAGE',
    content: 'Not all boxes are boxes. Some have eyes. They watch you search the others. They wait until you\'re desperate. Low on batteries. That\'s when they reveal themselves. Check the tape pattern. Diagonal means danger.',
  },
  {
    id: 'emergency_exit',
    title: 'BUILDING EVACUATION PLAN',
    content: 'In case of emergency, proceed to the nearest stairwell. The marked exits must remain unlocked whenever residents are inside. Handwritten note: management removed this paragraph from the posted copy.',
  },
  {
    id: 'something_below',
    title: 'ENGINEER\'S JOURNAL',
    content: 'The foundation does not match the approved plan. Management ordered the lower service routes sealed before the inspection was complete. Foreman says do not ask questions. At night, someone keeps testing the locked doors.',
  },
  {
    id: 'light_behavior',
    title: 'ELECTRICAL INSPECTION',
    content: 'Emergency lighting fails on Floors 1-3. Replacement bulbs burn out within hours. Wiring is standard code. No explanation. Note: Darkness seems to move. Advised occupants carry flashlights. Batteries drain faster than normal.',
  },
  {
    id: 'outside_doesnt_exist',
    title: 'INCIDENT SUMMARY',
    content: 'The official report states that the building was evacuated before the fire. Attached complaints and the exit inspection disagree. Several pages were removed before filing.',
  },
  // NEW FRAGMENTED/CORRUPTED ENTRIES
  {
    id: 'wall_observation',
    title: 'TORN DIARY PAGE',
    content: 'Day 3: I heard the wall move again. This time it was closer. The sound is different when they\'re hunting. Sarah says I\'m imagining it but I saw the corridor bend. I SAW IT—',
  },
  {
    id: 'box_instructions',
    title: 'FADED NOTE',
    content: 'Do not open the box if the hinges are facing\n\n[rest of text illegible]\n\n...already too late. It knows you\'re',
  },
  {
    id: 'floor_thirteen',
    title: 'MAINTENANCE REQUEST',
    content: 'The emergency stairwell is missing from the revised panel.\n\nA handwritten arrow points down to a line marked Floor 13.\n\nThe final instruction was torn away.',
  },
  {
    id: 'resident_408',
    title: 'APARTMENT 408 - FINAL ENTRY',
    content: 'The flashlight died. I can hear it breathing in the dark. Not the stalker - something else. Something that was always here. The darkness isn\'t empty. The darkness is',
  },
  {
    id: 'corrupted_log',
    title: '█████ PERSONNEL FILE',
    content: '██/██/20██: Resident complaint file removed after management review. Psychological evaluation: [REDACTED]. Recommendation: do not return the original to the tenant folder.',
  },
  {
    id: 'research_fragment',
    title: 'RESEARCH NOTE',
    content: 'The building doesn\'t have tenants. It has prisoners. Every floor you descend, you get closer to understanding what this place really is. Floor 13 is where',
  },
  {
    id: 'janitor_recording',
    title: 'VOICE MEMO TRANSCRIPT',
    content: '[00:14] "Found another body in the utility closet. Same as the others. Drained. Empty."\n[00:31] "Management says don\'t report it. Says it\'s—"\n[00:42] [sounds of footsteps]\n[00:44] [recording ends]',
  },
  {
    id: 'warning_scrawl',
    title: 'SCRIBBLED IN BLOOD',
    content: 'DONT USE YOUR LIGHT\n\nIT CAN SEE THE LIGHT\n\nIT FOLLOWS THE',
  },
];

/** Stable presentation lookup for deterministic floor-generated clue IDs. */
export function getAuthoredClueForSearchId(id: string): Clue | null {
  const match = /^clue_(\d+)_([0-9]+)_([0-9]+)$/.exec(id);
  if (!match) return null;
  const [, floor, room, item] = match;
  const currentFloor = Number(floor);
  const available = currentFloor >= 0 && currentFloor <= 4
    ? ALL_CLUES.filter(clue => (CLUE_REVEAL_FLOOR[clue.id] ?? 4) >= currentFloor)
    : ALL_CLUES;
  if (available.length === 0) return null;
  const index = (currentFloor + Number(room) + Number(item)) % available.length;
  return { ...available[index] };
}

export class ClueManager {
  private rng: SeededRng;
  private availableClues: Clue[];
  
  constructor(seed: number) {
    this.rng = new SeededRng(seed ^ 0xC10E5);
    
    // Select 6-9 clues for this run (expanded pool)
    const numClues = 6 + this.rng.int(4); // 6-9 clues
    this.availableClues = [];
    
    const indices = Array.from({ length: ALL_CLUES.length }, (_, i) => i);
    
    for (let i = 0; i < numClues && indices.length > 0; i++) {
      const idx = this.rng.int(indices.length);
      this.availableClues.push(ALL_CLUES[indices[idx]]);
      indices.splice(idx, 1);
    }
  }
  
  public getRandomClue(seenStoryIds: string[]): Clue | null {
    // Filter out already seen clues
    const unseenClues = this.availableClues.filter(clue => !seenStoryIds.includes(clue.id));
    
    if (unseenClues.length === 0) {
      // All clues have been seen - return null to show fallback message
      return null;
    }
    
    // Deterministically select from unseen clues
    const selectedClue = unseenClues[this.rng.int(unseenClues.length)];
    return selectedClue;
  }
}
