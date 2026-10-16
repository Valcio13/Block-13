import { describe, expect, it } from 'vitest';
import { generateFloor } from '../src/core/floor';
import { addNotebookDiscovery, addNotebookSearchEvents, discoveredObjectiveSteps, emptyNotebookJournal, notebookEntryForSearch } from '../src/game/investigationNotebook';

describe('investigation notebook projection', () => {
  it('records only a clue whose authoritative searched event is confirmed', () => {
    const floor = generateFloor(143, 4);
    const clueIndex = floor.objectives.searchableIndices[0];
    const ordinaryIndex = floor.searchables.findIndex(item => item.result.type !== 'clue');
    const journal = emptyNotebookJournal(143n);
    expect(journal.entries).toEqual([]);
    const ordinaryEntry = notebookEntryForSearch(floor, ordinaryIndex);
    expect(addNotebookDiscovery(journal, ordinaryEntry).entries).toEqual([]);
    const entry = notebookEntryForSearch(floor, clueIndex);
    expect(entry?.content).toContain('FIRST number');
    expect(addNotebookDiscovery(journal, entry).entries).toEqual([entry]);
  });

  it('deduplicates discoveries and exposes only searched evidence steps', () => {
    const floor = generateFloor(987, 2);
    const searched = floor.searchables.map(() => false);
    const objectiveIndex = floor.objectives.searchableIndices[0];
    expect(discoveredObjectiveSteps(floor, searched)).toEqual(new Set());
    searched[objectiveIndex] = true;
    expect(discoveredObjectiveSteps(floor, searched)).toEqual(new Set([0]));
    const entry = notebookEntryForSearch(floor, objectiveIndex)!;
    const journal = addNotebookDiscovery(emptyNotebookJournal('987'), entry);
    expect(addNotebookDiscovery(journal, entry)).toBe(journal);
    expect(journal.entries).toEqual([entry]);
  });

  it('rebuilds journal entries from confirmed search events and keeps history across floors', () => {
    const floor4 = generateFloor(321, 4);
    const floor3 = generateFloor(321, 3);
    let recovered = emptyNotebookJournal(321n);
    recovered = addNotebookSearchEvents(recovered, floor4, [{ type: 'puzzle_opened' }, { type: 'loot_searched', index: floor4.objectives.searchableIndices[0] }]);
    recovered = addNotebookSearchEvents(recovered, floor3, [{ type: 'loot_searched', index: floor3.objectives.searchableIndices[0] }]);
    expect(recovered.entries.map(entry => entry.floor)).toEqual([4, 3]);
    expect(addNotebookSearchEvents(emptyNotebookJournal(321n), floor4, [{ type: 'puzzle_opened' }]).entries).toEqual([]);
  });
});
