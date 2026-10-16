import type { Floor } from '../core/floor';
import { getAuthoredClueForSearchId } from '../core/clues';

/** Notebook content is a presentation projection of confirmed simulation discoveries. */
export interface NotebookEntry {
  id: string;
  floor: number;
  title: string;
  content: string;
  important: boolean;
}

export interface NotebookJournal {
  seed: string;
  entries: NotebookEntry[];
}

export function notebookEntryForSearch(floor: Floor, searchableIndex: number): NotebookEntry | undefined {
  const searchable = floor.searchables[searchableIndex];
  if (!searchable || searchable.result.type !== 'clue') return undefined;
  const authored = getAuthoredClueForSearchId(searchable.result.id);
  const objectiveStep = searchable.objectiveStep;
  const generated = objectiveStep === undefined ? undefined : floor.puzzle.clueTexts[objectiveStep];
  if (generated) {
    const [title, ...body] = generated.split(': ');
    return {
      id: `${floor.puzzle.floor}:${searchableIndex}`,
      floor: floor.puzzle.floor,
      title: title || `${floor.puzzle.title} // EVIDENCE ${(objectiveStep ?? 0) + 1}`,
      content: body.join(': ') || generated,
      important: true,
    };
  }
  if (!authored) return undefined;
  return {
    id: `${floor.puzzle.floor}:${searchableIndex}`,
    floor: floor.puzzle.floor,
    title: authored.title,
    content: authored.content,
    important: false,
  };
}

export function emptyNotebookJournal(seed: bigint | string): NotebookJournal {
  return { seed: seed.toString(), entries: [] };
}

export function addNotebookDiscovery(journal: NotebookJournal, entry: NotebookEntry | undefined): NotebookJournal {
  if (!entry || journal.entries.some(existing => existing.id === entry.id)) return journal;
  return { ...journal, entries: [...journal.entries, entry] };
}

/** The recovery path and live adapter share this event-only collection step. */
export function addNotebookSearchEvents(
  journal: NotebookJournal,
  floor: Floor,
  events: readonly { type: string; index?: number }[],
): NotebookJournal {
  return events.reduce((current, event) => event.type === 'loot_searched' && event.index !== undefined
    ? addNotebookDiscovery(current, notebookEntryForSearch(floor, event.index))
    : current, journal);
}

export function discoveredObjectiveSteps(floor: Floor, searched: readonly boolean[]): Set<number> {
  const steps = new Set<number>();
  for (const index of floor.objectives.searchableIndices) {
    if (searched[index]) {
      const step = floor.searchables[index]?.objectiveStep;
      if (step !== undefined) steps.add(step);
    }
  }
  return steps;
}

