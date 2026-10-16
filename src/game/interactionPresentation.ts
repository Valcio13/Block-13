import { FIXED_SCALE, INTERACTION_RANGE_SUBPIXELS, type AuthoritativeState } from '../core/authoritativeSimulation';
import type { Floor } from '../core/floor';
import { isBlock13Floor } from '../core/progression';

function withinInteractionRange(state: AuthoritativeState, tileX: number, tileY: number): boolean {
  const x = (tileX * 32 + 16) * FIXED_SCALE;
  const y = (tileY * 32 + 16) * FIXED_SCALE;
  const dx = state.x - x, dy = state.y - y;
  return dx * dx + dy * dy <= INTERACTION_RANGE_SUBPIXELS * INTERACTION_RANGE_SUBPIXELS;
}

/** Mirrors only current proximity eligibility and action priority for display copy. */
export function interactionPrompt(state: AuthoritativeState, floor: Floor): string {
  if (state.puzzle.active) return '';
  if (isBlock13Floor(state.floor) && !state.hasKey && withinInteractionRange(state, floor.key[0], floor.key[1])) return '[E] PICK UP KEY';
  if (!state.puzzle.solved && withinInteractionRange(state, floor.puzzleDevice[0], floor.puzzleDevice[1])) {
    return state.puzzle.fallbackActive && state.puzzle.fallbackItemFound
      ? '[E] FORCE OPEN DEVICE'
      : `[E] ${state.puzzle.fallbackActive ? 'DEVICE JAMMED' : `OPEN ${floor.puzzle.deviceLabel}`}`;
  }
  if (floor.puzzleFallbackSite && state.puzzle.fallbackActive && !state.puzzle.fallbackItemFound
    && withinInteractionRange(state, floor.puzzleFallbackSite[0], floor.puzzleFallbackSite[1])) return '[E] TAKE MAINTENANCE TOOL';
  const searchableOrder = [
    ...floor.objectives.searchableIndices,
    ...floor.searchables.map((_, index) => index).filter(index => !floor.objectives.searchableIndices.includes(index)),
  ];
  const index = searchableOrder.find(index => !state.searched[index] && withinInteractionRange(state, floor.searchables[index].x, floor.searchables[index].y)) ?? -1;
  if (index >= 0) {
    const searchable = floor.searchables[index];
    if (searchable.objectiveStep !== undefined) return `[E] INSPECT ${floor.objectives.clues[searchable.objectiveStep].toUpperCase()}`;
    return `[E] SEARCH ${searchable.objectType === 'maintenance_lockbox' ? 'MAINTENANCE LOCKBOX' : searchable.objectType.toUpperCase()}`;
  }
  if (!withinInteractionRange(state, floor.exit[0], floor.exit[1])) return '';
  if (isBlock13Floor(state.floor) && !state.objectiveComplete) return 'EXIT LOCKED — RECOVER THE FINAL MEMORY';
  if (isBlock13Floor(state.floor) && !state.hasKey) return 'EXIT LOCKED — FIND THE KEY';
  if (!isBlock13Floor(state.floor) && !state.objectiveComplete) return 'STAIRS LOCKED — SOLVE THE FLOOR PUZZLE';
  return isBlock13Floor(state.floor) ? '[E] ESCAPE OUTSIDE' : '[E] DESCEND STAIRS';
}

/** Feedback only for an E press that produced no authoritative interaction event. */
export function rejectedInteractionFeedback(state: AuthoritativeState, floor: Floor): string | undefined {
  if (isBlock13Floor(state.floor) && !state.objectiveComplete && withinInteractionRange(state, floor.exit[0], floor.exit[1])) return 'RECOVER THE FINAL MEMORY';
  if (isBlock13Floor(state.floor) && !state.hasKey && withinInteractionRange(state, floor.exit[0], floor.exit[1])) return 'FIND THE KEY TO UNLOCK THE WAY';
  if (!isBlock13Floor(state.floor) && !state.objectiveComplete && withinInteractionRange(state, floor.exit[0], floor.exit[1])) return 'SOLVE THE FLOOR PUZZLE TO UNLOCK THE STAIRS';
  const alreadySearched = floor.searchables.some((item, index) => state.searched[index] && withinInteractionRange(state, item.x, item.y));
  return alreadySearched ? 'ALREADY SEARCHED' : undefined;
}
