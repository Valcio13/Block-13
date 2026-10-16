import { describe, expect, it } from 'vitest';
import { generateFloor } from '../src/core/floor';
import { FIXED_SCALE, type AuthoritativeState } from '../src/core/authoritativeSimulation';
import { interactionPrompt, rejectedInteractionFeedback } from '../src/game/interactionPresentation';

function stateAt(tile: [number, number], floorNumber = 4): AuthoritativeState {
  const floor = generateFloor(123, floorNumber);
  return {
    tick: 0, playerMoveRemainderX: 0, playerMoveRemainderY: 0, floor: floorNumber, floorsCompleted: 0,
    x: (tile[0] * 32 + 16) * FIXED_SCALE, y: (tile[1] * 32 + 16) * FIXED_SCALE,
    hp: 100, battery: 100 * FIXED_SCALE, curse: 0, score: 0, status: 'playing', flashlightOn: true,
    hasKey: false, objectiveComplete: false, searched: floor.searchables.map(() => false),
    puzzle: { active: false, solved: false, attemptsRemaining: floorNumber === 4 || floorNumber === 3 ? 3 : 0, failures: 0,
      fallbackActive: false, fallbackItemFound: false, selectedIndex: 0, enteredCode: [0, 0, 0], switchMask: 0, circuitSequence: [],
      recordOrder: [], memoryAnswers: [0, 0, 0], memoryConfirmedMask: 0, directionMask: 0 },
    invulnerableUntilTick: 0, scareLockoutUntilTick: 0,
    facingX: 0, facingY: 1,
    stalker: { state: 'dormant', x: 0, y: 0, targetX: 0, targetY: 0, ticksRemaining: 0, chaseStartTick: 0, lastChaseEndTick: 0, visible: false, moveRemainder: 0 },
    crawlers: [], watchers: [], ambushers: [], mimics: [], corruption: { lastTriggerTick: 0, effectId: 0, effectType: 0, intensityPermille: 0, durationTicks: 0 },
    boxScare: { lastTriggerTick: 0, lastType: 0, availableTypes: [] }, scareEventId: 0, damageEventId: 0, lastDamage: 0,
  };
}

describe('interaction presentation', () => {
  it('shows only nearby actionable prompts in the authoritative priority order', () => {
    const floor = generateFloor(123, 4);
    expect(interactionPrompt(stateAt(floor.key), floor)).toBe('[E] OPEN MAINTENANCE LOCKBOX');
    const searchable = floor.searchables[0];
    expect(interactionPrompt(stateAt([searchable.x, searchable.y]), floor)).toBe(`[E] SEARCH ${searchable.objectType.toUpperCase()}`);
    expect(interactionPrompt(stateAt([floor.start[0], floor.start[1]]), floor)).toBe('');
  });

  it('explains locked exit and already-searched attempts without changing state', () => {
    const floor = generateFloor(123, 4);
    const state = stateAt(floor.exit);
    state.searched.fill(true);
    expect(interactionPrompt(state, floor)).toBe('STAIRS LOCKED — SOLVE THE FLOOR PUZZLE');
    expect(rejectedInteractionFeedback(state, floor)).toBe('SOLVE THE FLOOR PUZZLE TO UNLOCK THE STAIRS');
    const index = 0;
    state.searched[index] = true;
    const target = floor.searchables[index];
    state.hasKey = true;
    state.x = (target.x * 32 + 16) * FIXED_SCALE;
    state.y = (target.y * 32 + 16) * FIXED_SCALE;
    const before = structuredClone(state);
    expect(rejectedInteractionFeedback(state, floor)).toBe('ALREADY SEARCHED');
    expect(state).toEqual(before);
  });
});
