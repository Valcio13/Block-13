import { SeededRng } from './rng';

export interface Clue {
  id: string;
  title: string;
  content: string;
}

// 18 authored horror story fragments for Block 13 (mix of complete and fragmented)
const ALL_CLUES: Clue[] = [
  {
    id: 'missing_tenants',
    title: 'MISSING PERSONS REPORT',
    content: 'Building management reports three tenants failed to return from Floor 13. Security footage shows them entering the elevator. The elevator never arrived at Floor 13. It doesn\'t exist on any blueprint.',
  },
  {
    id: 'elevator_log',
    title: 'ELEVATOR MAINTENANCE LOG',
    content: 'Technician Note: Elevator #3 keeps stopping between floors. Display shows "13" but shaft inspection confirms no 13th floor exists. Passengers report hearing walls move. Recommended: full system replacement.',
  },
  {
    id: 'security_incident',
    title: 'SECURITY GUARD REPORT',
    content: 'Night shift, 3:47 AM. Heard footsteps on empty Floor 2. Investigated. Found wet footprints leading to stairwell. Stairs only go down. Followed them. They led back to where I started. I quit tomorrow.',
  },
  {
    id: 'previous_resident',
    title: 'RECOVERED NOTE',
    content: 'If you\'re reading this, you\'re trapped too. The floors go: 4, 3, 2, 1, then Block 13. You can\'t skip it. You have to go through. I tried going back up. The stairs only go down now. Always down.',
  },
  {
    id: 'contractor_warning',
    title: 'CONTRACTOR MEMO',
    content: 'DO NOT accept renovation work in this building. Walls move when you\'re not looking. Measured a corridor at 40 feet. Turned around to get materials. Same corridor now 65 feet. Blueprints are useless here.',
  },
  {
    id: 'box_warning',
    title: 'SCRAWLED MESSAGE',
    content: 'Not all boxes are boxes. Some have eyes. They watch you search the others. They wait until you\'re desperate. Low on batteries. That\'s when they reveal themselves. Check the tape pattern. Diagonal means danger.',
  },
  {
    id: 'emergency_exit',
    title: 'BUILDING EVACUATION PLAN',
    content: 'In case of emergency, proceed to nearest stairwell and exit building. DO NOT use stairs marked "Emergency Exit Only." Those stairs lead to Block 13. Once you enter Block 13, the only exit is through.',
  },
  {
    id: 'something_below',
    title: 'ENGINEER\'S JOURNAL',
    content: 'The foundation doesn\'t make sense. Building has 12 floors but the elevator shaft goes down 15 stories. Foreman says don\'t ask questions. At night, you can hear something breathing in the sub-basement. Something big.',
  },
  {
    id: 'light_behavior',
    title: 'ELECTRICAL INSPECTION',
    content: 'Emergency lighting fails on Floors 1-3. Replacement bulbs burn out within hours. Wiring is standard code. No explanation. Note: Darkness seems to move. Advised occupants carry flashlights. Batteries drain faster than normal.',
  },
  {
    id: 'outside_doesnt_exist',
    title: 'LAST TRANSMISSION',
    content: 'Made it to ground floor. Door says "EXIT." Opened it. Saw Floor 1 again. Tried windows. Same thing. Every window, every door - leads back inside. I think I understand now. There is no outside. There never was.',
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
    content: 'Floor 13 isn\'t on the panel.\n\nIt appeared after midnight.\n\nI pressed it and',
  },
  {
    id: 'resident_408',
    title: 'APARTMENT 408 - FINAL ENTRY',
    content: 'The flashlight died. I can hear it breathing in the dark. Not the stalker - something else. Something that was always here. The darkness isn\'t empty. The darkness is',
  },
  {
    id: 'corrupted_log',
    title: '█████ PERSONNEL FILE',
    content: '██/██/20██: Subject exhibited [REDACTED] after 72 hours below Floor 1. Psychological eval: ███████. Recommendation: ████████ ██ ███████ ███. Note: "Block 13" was not part of original design.',
  },
  {
    id: 'research_fragment',
    title: 'RESEARCH NOTE',
    content: 'The building doesn\'t have tenants. It has prisoners. Every floor you descend, you get closer to understanding what this place really is. Block 13 is where',
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
