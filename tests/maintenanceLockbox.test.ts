import { describe, expect, it } from 'vitest';
import { chooseMaintenanceLockboxPosition, generateFloor } from '../src/core/floor';
import { AuthoritativeSimulation, FIXED_SCALE } from '../src/core/authoritativeSimulation';
import { objectiveCopy } from '../src/game/contestUx';
import { interactionPrompt } from '../src/game/interactionPresentation';
import { InputRecorder, InputReplayer } from '../src/core/inputRecorder';
import { createRunCheckpoint, hashAuthoritativeState, validateRunRecovery } from '../src/core/runRecovery';
import { keccak256, toHex } from 'viem';

const dirs: Array<[number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function path(floor: ReturnType<typeof generateFloor>, start: [number, number], goal: [number, number]) {
  const width = floor.width, first = start[1] * width + start[0], last = goal[1] * width + goal[0];
  const parent = new Int32Array(width * floor.height); parent.fill(-2); parent[first] = -1;
  const queue = new Int32Array(parent.length); queue[0] = first; let head = 0, tail = 1;
  while (head < tail && parent[last] === -2) {
    const here = queue[head++], x = here % width, y = Math.floor(here / width);
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy, next = ny * width + nx;
      if (nx < 0 || ny < 0 || nx >= width || ny >= floor.height || !floor.tiles[ny]?.[nx] || parent[next] !== -2) continue;
      parent[next] = here; queue[tail++] = next;
    }
  }
  if (parent[last] === -2) return [];
  const result: [number, number][] = [];
  for (let cursor = last; cursor !== first; cursor = parent[cursor]) result.push([cursor % width, Math.floor(cursor / width)]);
  return result.reverse();
}

function emptyActors() {
  return { stalker: { state: 'dormant' as const, x: 0, y: 0, targetX: 0, targetY: 0, ticksRemaining: 10000, chaseStartTick: 0, lastChaseEndTick: 0, visible: false, moveRemainder: 0 }, crawlers: [], watchers: [], ambushers: [], mimics: [] };
}

function walkTo(sim: AuthoritativeSimulation, target: [number, number]) {
  let at: [number, number] = [Math.floor(sim.state.x / (32 * FIXED_SCALE)), Math.floor(sim.state.y / (32 * FIXED_SCALE))];
  const route = path(sim.floor, at, target);
  expect(route.length).toBeGreaterThan(0);
  for (const [x, y] of route) {
    const dx = x - at[0], dy = y - at[1];
    const input = { left: dx < 0, right: dx > 0, up: dy < 0, down: dy > 0, flashlight: false, interact: false };
    for (let tick = 0; tick < 12; tick++) sim.step(input);
    at = [x, y];
  }
}

describe('Maintenance Lockbox', () => {
  it('places exactly one deterministic, reachable optional reward on each ordinary floor and none on Floor 13', () => {
    for (const floorNumber of [4, 3, 2, 1]) for (let seed = 0; seed < 20; seed++) {
      const floor = generateFloor(seed, floorNumber), repeat = generateFloor(seed, floorNumber);
      const boxes = floor.searchables.filter(item => item.objectType === 'maintenance_lockbox');
      expect(boxes).toHaveLength(1);
      expect(boxes[0]).toMatchObject({ result: { type: 'battery', amount: 20 }, isMimic: false });
      expect(boxes.map(({ x, y }) => [x, y])).toEqual(repeat.searchables.filter(item => item.objectType === 'maintenance_lockbox').map(({ x, y }) => [x, y]));
      expect(path(floor, floor.start, [boxes[0].x, boxes[0].y]).length).toBeGreaterThan(0);
      expect(floor.tiles[boxes[0].y][boxes[0].x]).toBe(true);
      expect(`${boxes[0].x},${boxes[0].y}`).not.toBe(`${floor.exit[0]},${floor.exit[1]}`);
      expect(floor.doors).not.toContainEqual([boxes[0].x, boxes[0].y]);
      expect(floor.searchables.filter(item => item !== boxes[0]).some(item => item.x === boxes[0].x && item.y === boxes[0].y)).toBe(false);
      const fromStart = path(floor, floor.start, [boxes[0].x, boxes[0].y]).length;
      const fromExit = path(floor, floor.exit, [boxes[0].x, boxes[0].y]).length;
      expect(fromStart).toBeGreaterThanOrEqual(({ 4: 7, 3: 10, 2: 13, 1: 16 } as Record<number, number>)[floorNumber]);
      expect(fromExit).toBeGreaterThanOrEqual(({ 4: 5, 3: 6, 2: 7, 1: 8 } as Record<number, number>)[floorNumber]);
    }
    expect(generateFloor(42, 0).searchables.some(item => item.objectType === 'maintenance_lockbox')).toBe(false);
  });

  it('keeps the spawned lockbox clear of enemies and other interactables', () => {
    for (const floorNumber of [4, 3, 2, 1]) for (let seed = 1; seed <= 8; seed++) {
      const sim = new AuthoritativeSimulation(BigInt(seed * 1000 + floorNumber), { floor: floorNumber });
      const floor = sim.floor, box = floor.searchables.find(item => item.objectType === 'maintenance_lockbox')!;
      const occupied = [
        ...sim.state.crawlers, ...sim.state.watchers, ...sim.state.ambushers, ...sim.state.mimics,
        sim.state.stalker,
      ].map(actor => `${Math.floor(actor.x / (32 * FIXED_SCALE))},${Math.floor(actor.y / (32 * FIXED_SCALE))}`);
      expect(occupied).not.toContain(`${box.x},${box.y}`);
      expect(floor.searchables.filter(item => item !== box).some(item => item.x === box.x && item.y === box.y)).toBe(false);
      expect(floor.doors).not.toContainEqual([box.x, box.y]);
      expect([floor.start, floor.exit]).not.toContainEqual([box.x, box.y]);
    }
  });

  it('places the Floor 4 lockbox and puzzle device on open, walkable floor tiles', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const floor = generateFloor(seed * 173, 4);
      const box = floor.searchables.find(item => item.objectType === 'maintenance_lockbox')!;
      const neighbors = dirs.filter(([dx, dy]) => floor.tiles[box.y + dy]?.[box.x + dx] === true).length;
      expect(floor.tiles[box.y]?.[box.x]).toBe(true);
      expect(neighbors).toBeGreaterThanOrEqual(3);
      expect(floor.puzzleDevice).toEqual([box.x, box.y]);
      expect(path(floor, floor.start, [box.x, box.y]).length).toBeGreaterThan(0);
    }
  });

  it('has a reachable bounded fallback that avoids occupied map interactables', () => {
    const floor = generateFloor(93, 1);
    const position = chooseMaintenanceLockboxPosition({ ...floor, floor: 1, occupied: [floor.start, floor.exit] });
    expect(floor.tiles[position[1]][position[0]]).toBe(true);
    expect(path(floor, floor.start, position).length).toBeGreaterThan(0);
    expect(position).not.toEqual(floor.start);
    expect(position).not.toEqual(floor.exit);
  });

  it('uses the lockbox as Floor 4 primary puzzle gate and grants the key only after a correct code', () => {
    const sim = new AuthoritativeSimulation(776655n, { floor: 4, ...emptyActors() });
    const floor = sim.floor, box = floor.searchables.find(item => item.objectType === 'maintenance_lockbox')!;
    expect(objectiveCopy(4, false)).toBe('OBJECTIVE: OPEN THE MAINTENANCE LOCKBOX');
    expect(floor.puzzleDevice).toEqual([box.x, box.y]);
    expect(interactionPrompt({ ...sim.state, x: (box.x * 32 + 16) * FIXED_SCALE, y: (box.y * 32 + 16) * FIXED_SCALE }, floor)).toBe('[E] OPEN MAINTENANCE LOCKBOX');
    for (const index of floor.objectives.searchableIndices) {
      const clue = floor.searchables[index];
      walkTo(sim, [clue.x, clue.y]);
      sim.step({ left: false, right: false, up: false, down: false, flashlight: false, interact: true });
      sim.step({ left: false, right: false, up: false, down: false, flashlight: false, interact: false });
    }
    walkTo(sim, [box.x, box.y]);
    const press = (direction: 'left' | 'right' | 'up' | 'down' | 'interact') => {
      sim.step({ left: direction === 'left', right: direction === 'right', up: direction === 'up', down: direction === 'down', flashlight: false, interact: direction === 'interact' });
      sim.step({ left: false, right: false, up: false, down: false, flashlight: false, interact: false });
    };
    press('interact');
    expect(sim.state.puzzle.active).toBe(true);
    for (let index = 0; index < 3; index++) {
      if (index > 0) press('right');
      for (let step = 0; step < floor.puzzle.solutionCode![index]; step++) press('up');
    }
    const solved = sim.stepWithEvents({ left: false, right: false, up: false, down: false, flashlight: false, interact: true });
    expect(solved.state.objectiveComplete).toBe(true);
    expect(solved.state.hasKey).toBe(true);
    expect(solved.state.puzzle.solved).toBe(true);
    expect(solved.events).toContainEqual(expect.objectContaining({ type: 'puzzle_solved', floor: 4 }));
    expect(solved.events).toContainEqual(expect.objectContaining({ type: 'loot_searched', result: { type: 'battery', amount: 20 } }));
    walkTo(sim, floor.exit);
    let descended = sim.stepWithEvents({ left: false, right: false, up: false, down: false, flashlight: false, interact: true });
    for (let attempt = 0; attempt < floor.searchables.length && descended.state.floor === 4; attempt++) {
      sim.stepWithEvents({ left: false, right: false, up: false, down: false, flashlight: false, interact: false });
      descended = sim.stepWithEvents({ left: false, right: false, up: false, down: false, flashlight: false, interact: true });
    }
    expect(descended.state.floor).toBe(3);
  });

  it('keeps the spawned Floor 4 puzzle target attached to the enemy-safe lockbox position', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const sim = new AuthoritativeSimulation(BigInt(seed * 997), { floor: 4 });
      const floor = sim.floor;
      const box = floor.searchables.find(item => item.objectType === 'maintenance_lockbox')!;
      expect(floor.puzzleDevice).toEqual([box.x, box.y]);
      expect(interactionPrompt({
        ...sim.state,
        x: (box.x * 32 + 16) * FIXED_SCALE,
        y: (box.y * 32 + 16) * FIXED_SCALE,
      }, floor)).toBe('[E] OPEN MAINTENANCE LOCKBOX');
    }
  });

  it('recovers deterministically with the Floor 4 puzzle panel open', () => {
    const seed = 998811n;
    const sim = new AuthoritativeSimulation(seed);
    const recorder = new InputRecorder();
    const runState = { floor: 4, battery: 100, curse: 0, hp: 100, score: 0, status: 'playing' as const, floorsCompleted: 0,
      timeStarted: 1, seenStoryIds: [], seed: Number(seed & 0xffff_ffffn), canonicalSeed: seed.toString() };
    const recover = () => {
      const inputLog = recorder.encodeBinary();
      const checkpoint = createRunCheckpoint({ runState, inputLog, terminalTick: sim.state.tick,
        stateHash: hashAuthoritativeState(sim.state), inputHash: keccak256(toHex(inputLog)) });
      return validateRunRecovery({ runState: checkpoint.runState, inputLog, terminalTick: checkpoint.terminalTick,
        stateHash: checkpoint.stateHash, inputHash: checkpoint.inputHash });
    };
    expect(recover().state).toEqual(sim.state);
    let tick = 0;
    const recordedStep = (input: { left: boolean; right: boolean; up: boolean; down: boolean; flashlight: boolean; interact: boolean }) => {
      sim.step(input); recorder.recordTick(tick++, input);
    };
    const walkRecorded = (target: [number, number]) => {
      let at: [number, number] = [Math.floor(sim.state.x / (32 * FIXED_SCALE)), Math.floor(sim.state.y / (32 * FIXED_SCALE))];
      for (const [x, y] of path(sim.floor, at, target)) {
        const input = { left: x < at[0], right: x > at[0], up: y < at[1], down: y > at[1], flashlight: false, interact: false };
        for (let step = 0; step < 12; step++) recordedStep(input);
        at = [x, y];
      }
    };
    for (const index of sim.floor.objectives.searchableIndices) {
      const clue = sim.floor.searchables[index];
      walkRecorded([clue.x, clue.y]);
      recordedStep({ left: false, right: false, up: false, down: false, flashlight: false, interact: true });
      recordedStep({ left: false, right: false, up: false, down: false, flashlight: false, interact: false });
    }
    const box = sim.floor.searchables.find(item => item.objectType === 'maintenance_lockbox')!;
    walkRecorded([box.x, box.y]);
    recordedStep({ left: false, right: false, up: false, down: false, flashlight: false, interact: true });
    expect(sim.state.hasKey).toBe(false);
    expect(sim.state.puzzle.active).toBe(true);
    if (sim.floor.puzzle.solutionCode![0] === 0) {
      recordedStep({ left: false, right: false, up: true, down: false, flashlight: false, interact: false });
      recordedStep({ left: false, right: false, up: false, down: false, flashlight: false, interact: false });
    }
    recordedStep({ left: false, right: false, up: false, down: false, flashlight: false, interact: true });
    recordedStep({ left: false, right: false, up: false, down: false, flashlight: false, interact: false });
    expect(sim.state.puzzle.failures).toBe(1);
    expect(sim.state.puzzle.attemptsRemaining).toBe(2);
    const recovered = recover();
    expect(recovered.state).toEqual(sim.state);
    const lockboxIndex = sim.floor.searchables.findIndex(item => item.objectType === 'maintenance_lockbox');
    expect(recovered.state.puzzle.active).toBe(true);
    expect(recovered.state.puzzle.failures).toBe(1);
    expect(recovered.state.puzzle.attemptsRemaining).toBe(2);
    expect(recovered.state.searched[lockboxIndex]).toBe(false);
    const neutral = { left: false, right: false, up: false, down: false, flashlight: false, interact: false };
    const futureEndTick = sim.state.tick + 20;
    for (let futureTick = sim.state.tick; futureTick < futureEndTick; futureTick++) {
      sim.step(neutral); recorder.recordTick(tick++, neutral);
    }
    const replay = new AuthoritativeSimulation(seed, {
      floor: 4,
      hp: 100,
      battery: 100 * FIXED_SCALE,
      curse: 0,
      score: 0,
      floorsCompleted: 0,
    });
    const inputSource = InputReplayer.fromBinary(recorder.encodeBinary());
    for (let replayTick = 0; replayTick < sim.state.tick; replayTick++) replay.step(inputSource.getStateAtTick(replayTick));
    expect(replay.state).toEqual(sim.state);
  });
});
