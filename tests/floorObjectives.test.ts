import { describe, expect, it } from 'vitest';
import { AuthoritativeSimulation, FIXED_SCALE } from '../src/core/authoritativeSimulation';
import type { InputState } from '../src/core/inputRecorder';

const neutral: InputState = { left: false, right: false, up: false, down: false, flashlight: false, interact: false };
const noSpawnEnemies = {
  stalker: { state: 'dormant' as const, x: 0, y: 0, targetX: 0, targetY: 0, ticksRemaining: 100_000, chaseStartTick: 0, lastChaseEndTick: 0, visible: false, moveRemainder: 0 },
  crawlers: [], watchers: [], ambushers: [], mimics: [],
};

describe('authoritative floor puzzle progression', () => {
  it('keeps evidence replay-derived without unlocking progression by itself', () => {
    for (const floorNumber of [4, 3, 2, 1, 0]) {
      const sim = new AuthoritativeSimulation(BigInt(0x1300 + floorNumber), { floor: floorNumber });
      expect(sim.floor.objectives.searchableIndices.length).toBe(sim.floor.puzzle.clueTexts.length);
      expect(sim.state.objectiveComplete).toBe(false);
      expect(sim.state.puzzle.solved).toBe(false);
      expect(sim.floor.puzzleDevice.every(Number.isInteger)).toBe(true);
    }
  });

  it('opens, accepts the generated answer, and unlocks only the intended floor progression for all five puzzles', () => {
    for (const floorNumber of [4, 3, 2, 1, 0]) {
      const seed = BigInt(0x2600 + floorNumber);
      const probe = new AuthoritativeSimulation(seed, { floor: floorNumber, ...noSpawnEnemies });
      const floor = probe.floor;
      const puzzle = floor.puzzle;
      const [deviceX, deviceY] = floor.puzzleDevice;
      const sim = new AuthoritativeSimulation(seed, {
        ...probe.state,
        x: (deviceX * 32 + 16) * FIXED_SCALE,
        y: (deviceY * 32 + 16) * FIXED_SCALE,
        searched: probe.state.searched.map((_, index) => floor.objectives.searchableIndices.includes(index)),
        stalker: { ...probe.state.stalker, state: 'dormant', ticksRemaining: 100_000 },
        crawlers: [], watchers: [], ambushers: [], mimics: [],
      });
      const press = (direction: 'left' | 'right' | 'up' | 'down' | 'interact') => {
        sim.step({ ...neutral, [direction]: direction !== 'interact', interact: direction === 'interact' });
        sim.step(neutral);
      };
      press('interact');
      expect(sim.state.puzzle.active).toBe(true);
      if (puzzle.kind === 'combination') {
        for (let index = 0; index < 3; index++) {
          if (index > 0) press('right');
          for (let digit = 0; digit < puzzle.solutionCode![index]; digit++) press('up');
        }
      } else if (puzzle.kind === 'resident') {
        for (let i = 0; i < puzzle.correctResident!; i++) press('down');
      } else if (puzzle.kind === 'circuit') {
        let selected = 0;
        for (const index of puzzle.circuitOrder!) {
          while (selected !== index) { press('right'); selected = (selected + 1) % puzzle.circuitLabels!.length; }
          press('up');
        }
      } else if (puzzle.kind === 'records') {
        let selected = 0;
        for (const desired of puzzle.recordOrder!) {
          while (selected !== desired) { press('down'); selected = (selected + 1) % 3; }
          press('interact');
          selected = 0;
        }
      } else {
        for (let fragment = 0; fragment < 3; fragment++) {
          const answer = puzzle.memoryAnswers![fragment];
          for (let step = 0; step < answer; step++) press('down');
          press('interact');
        }
      }
      press('interact');
      expect(sim.state.puzzle.solved, `floor ${floorNumber} ${puzzle.kind}`).toBe(true);
      expect(sim.state.objectiveComplete).toBe(true);
      expect(sim.state.puzzle.active).toBe(false);
      expect(sim.state.hasKey).toBe(floorNumber === 4 || floorNumber === 3);
    }
  });

  it('consumes attempts only on failed submissions and activates reachable fallback after three failures', () => {
    for (const floorNumber of [4, 3]) {
      const seed = BigInt(0x5000 + floorNumber);
      const probe = new AuthoritativeSimulation(seed, { floor: floorNumber, ...noSpawnEnemies });
      const floor = probe.floor;
      const [x, y] = floor.puzzleDevice;
      const sim = new AuthoritativeSimulation(seed, {
        ...probe.state, x: (x * 32 + 16) * FIXED_SCALE, y: (y * 32 + 16) * FIXED_SCALE,
        searched: probe.state.searched.map((_, index) => floor.objectives.searchableIndices.includes(index)),
        stalker: { ...probe.state.stalker, state: 'dormant', ticksRemaining: 100_000 }, crawlers: [], watchers: [], ambushers: [], mimics: [],
      });
      sim.step({ ...neutral, interact: true });
      sim.step(neutral);
      expect(sim.state.puzzle.attemptsRemaining).toBe(3);
      if (floorNumber === 4 && floor.puzzle.solutionCode!.every(digit => digit === 0)) {
        sim.step({ ...neutral, up: true }); sim.step(neutral);
      } else if (floorNumber === 3 && floor.puzzle.correctResident === 0) {
        sim.step({ ...neutral, down: true }); sim.step(neutral);
      }
      for (let failure = 1; failure <= 3; failure++) {
        const events = sim.stepWithEvents({ ...neutral, interact: true }).events;
        expect(events.some(event => event.type === 'puzzle_wrong_answer')).toBe(true);
        expect(sim.state.puzzle.attemptsRemaining).toBe(3 - failure);
        if (failure < 3) sim.step(neutral);
      }
      expect(sim.state.puzzle.fallbackActive).toBe(true);
      expect(sim.state.puzzle.active).toBe(false);
      expect(floor.puzzleFallbackSite).toBeDefined();
      sim.step({ ...neutral, interact: true });
      sim.step(neutral);
      const locked = sim.stepWithEvents({ ...neutral, interact: true });
      expect(locked.events).toHaveLength(0);
      expect(locked.state.puzzle.failures).toBe(3);
      expect(locked.state.puzzle.attemptsRemaining).toBe(0);
      sim.step({ ...neutral, flashlight: true });
      sim.step(neutral);
      const [fallbackX, fallbackY] = floor.puzzleFallbackSite!;
      const fallbackSim = new AuthoritativeSimulation(seed, {
        ...sim.state, x: (fallbackX * 32 + 16) * FIXED_SCALE, y: (fallbackY * 32 + 16) * FIXED_SCALE,
      });
      const found = fallbackSim.stepWithEvents({ ...neutral, interact: true });
      expect(found.events).toContainEqual({ type: 'puzzle_fallback_item_found', floor: floorNumber });
      expect(fallbackSim.state.puzzle.fallbackItemFound).toBe(true);
      const [deviceX, deviceY] = floor.puzzleDevice;
      const returned = new AuthoritativeSimulation(seed, {
        ...fallbackSim.state, x: (deviceX * 32 + 16) * FIXED_SCALE, y: (deviceY * 32 + 16) * FIXED_SCALE,
      });
      const completed = returned.stepWithEvents({ ...neutral, interact: true });
      expect(completed.state.puzzle.solved).toBe(true);
      expect(completed.state.objectiveComplete).toBe(true);
      expect(completed.state.hasKey).toBe(true);
    }
  });
});
