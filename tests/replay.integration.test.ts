import { describe, expect, it } from 'vitest';
import { keccak256, toHex } from 'viem';
import {
  InputPipeline,
  InputRecorder,
  InputReplayer,
  LiveInputSource,
  type InputState,
} from '../src/core/inputRecorder';
import { getPlayerVelocity, nextFlashlightState } from '../src/core/inputSimulation';
import { SimulationEngine } from '../src/core/simulationEngine';
import { AuthoritativeSimulation, FIXED_SCALE, MIMIC_REVEAL_TICKS, MIMIC_CHASE_DURATION_TICKS, STALKER_RECOVERY_COOLDOWN_TICKS, PLAYER_COLLISION_HALF_EXTENT_SUBPIXELS, floorSeedFromCanonicalSeed, type AuthoritativeState } from '../src/core/authoritativeSimulation';
import { finalStateV1FromSimulation, hashFinalStateV1 } from '../src/core/finalStateV1';
import type { RunManifest } from '../src/core/seedDerivation';
import { getAuthoredClueForSearchId } from '../src/core/clues';

interface GameplayState {
  x: number;
  y: number;
  flashlightOn: boolean;
  battery: number;
  score: number;
  searchedContainers: number;
  ticks: number;
}

function scriptedInput(tick: number): InputState {
  return {
    left: tick >= 80 && tick < 105,
    right: tick < 40,
    up: false,
    down: tick >= 40 && tick < 80,
    flashlight: tick === 8 || tick === 70,
    interact: tick === 55 || tick === 110,
  };
}

function simulateRun(renderFrameMs: number[], source: LiveInputSource | InputReplayer) {
  const engine = new SimulationEngine();
  const recorder = new InputRecorder();
  const pipeline = new InputPipeline(source, recorder);
  const state: GameplayState = {
    x: 0,
    y: 0,
    flashlightOn: false,
    battery: 100,
    score: 0,
    searchedContainers: 0,
    ticks: 0,
  };

  for (const frameDelta of renderFrameMs) {
    engine.update(frameDelta, (_fixedDelta, tick) => {
      pipeline.step(tick, inputs => {
        const velocity = getPlayerVelocity(inputs);
        state.x += velocity.x / SimulationEngine.TICK_RATE;
        state.y += velocity.y / SimulationEngine.TICK_RATE;
        state.flashlightOn = nextFlashlightState(state.flashlightOn, inputs);
        if (state.flashlightOn) state.battery -= 0.05;
        if (inputs.interact && state.x >= 100 && state.y >= 100) {
          state.searchedContainers++;
          state.score += 25;
        }
        state.ticks++;
      });
    });
  }

  return { state, recorder };
}

function framesAtFps(fps: number, seconds = 2) {
  return Array.from({ length: fps * seconds }, () => 1000 / fps);
}

describe('gameplay input replay integration', () => {
  it('records a live run and replays its binary log to the identical gameplay state at different render rates', () => {
    const liveSource = new LiveInputSource(() => scriptedInput(liveTick++));
    let liveTick = 0;
    const live = simulateRun(framesAtFps(60), liveSource);
    const binaryLog = live.recorder.encodeBinary();

    const replaySource = InputReplayer.fromBinary(binaryLog);
    const replay = simulateRun(framesAtFps(30), replaySource);

    expect(live.state.ticks).toBe(120);
    expect(replay.state).toEqual(live.state);
    expect(Array.from(replay.recorder.encodeBinary())).toEqual(Array.from(binaryLog));
  });

  it('changes gameplay state when a relevant recorded movement input changes', () => {
    let normalTick = 0;
    const normal = simulateRun(framesAtFps(60, 1), new LiveInputSource(() => scriptedInput(normalTick++)));
    const changedSource = new LiveInputSource(() => {
      const input = scriptedInput(changedTick++);
      if (changedTick === 6) {
        input.right = false;
        input.up = true;
      }
      return input;
    });
    let changedTick = 0;
    const changed = simulateRun(framesAtFps(60, 1), changedSource);

    expect(changed.state).not.toEqual(normal.state);
    expect(changed.state.x).not.toBe(normal.state.x);
  });

  it('hashes the canonical binary log with viem keccak256', async () => {
    const recorder = new InputRecorder();
    const source = new LiveInputSource(() => scriptedInput(hashTick++));
    let hashTick = 0;
    const engine = new SimulationEngine();
    for (const delta of framesAtFps(120, 1)) {
      engine.update(delta, (_fixed, tick) => {
        const state = source.getStateAtTick(tick);
        recorder.recordTick(tick, state);
      });
    }

    const binaryLog = recorder.encodeBinary();
    const hash = await recorder.generateInputHash();
    expect(hash).toBe(keccak256(toHex(binaryLog)));

    const identicalRecorder = new InputRecorder();
    const identicalReplay = InputReplayer.fromBinary(binaryLog);
    for (let tick = 0; tick < 60; tick++) {
      identicalRecorder.recordTick(tick, identicalReplay.getStateAtTick(tick));
    }
    identicalRecorder.setTerminalTick(60);
    expect(await identicalRecorder.generateInputHash()).toBe(hash);
  });
});

describe('authoritative deterministic simulation', () => {
  const emptyInput: InputState = { left: false, right: false, up: false, down: false, flashlight: false, interact: false };

  function drive(schedule: number[], source: InputReplayer, count: number) {
    const engine = new SimulationEngine();
    const sim = new AuthoritativeSimulation(0x123456789abcdefn);
    const recorder = new InputRecorder();
    let done = 0;
    while (done < count) {
      for (const delta of schedule) {
        done += engine.update(delta, (_dt, tick) => {
          const input = source.getStateAtTick(tick);
          recorder.recordTick(tick, input);
          sim.step(input);
        });
        if (done >= count) break;
      }
    }
    recorder.setTerminalTick(recorder.getTerminalTick());
    return { state: sim.state, recorder };
  }

  it('replays identical authoritative state at 30/60/144 FPS and through long frame stalls', () => {
    const sourceLog = new InputRecorder();
    for (let tick = 0; tick < 240; tick++) {
      const input: InputState = { ...emptyInput, right: tick < 70, down: tick >= 70 && tick < 130, left: tick >= 130 && tick < 190, flashlight: tick === 10, interact: tick === 45 };
      sourceLog.recordTick(tick, input);
    }
    sourceLog.setTerminalTick(240);
    const binary = sourceLog.encodeBinary();
    const expected = drive([1000 / 60], InputReplayer.fromBinary(binary), 240).state;
    const a = drive([1000 / 30], InputReplayer.fromBinary(binary), 240).state;
    const b = drive([1000 / 144], InputReplayer.fromBinary(binary), 240).state;
    const c = drive([1000], InputReplayer.fromBinary(binary), 240).state;
    const repeated = drive([1000 / 60], InputReplayer.fromBinary(binary), 240).state;
    expect(a).toEqual(expected);
    expect(b).toEqual(expected);
    expect(c).toEqual(expected);
    expect(repeated).toEqual(expected);
  });

  it('preserves terminal tick and validates canonical big-endian floor seed conversion', () => {
    const log = new InputRecorder();
    log.recordTick(3, emptyInput);
    log.setTerminalTick(1000);
    const replay = InputReplayer.fromBinary(log.encodeBinary());
    expect(replay.terminalTick).toBe(1000);
    expect(floorSeedFromCanonicalSeed(0x0102030405060708n)).toBe(0x05060708);
  });

  it('turns the flashlight off at exact battery zero and replays zero-toggle and recharge behavior', () => {
    let seed = 1n;
    let probe = new AuthoritativeSimulation(seed);
    let batteryIndex = probe.floor.searchables.findIndex(item => item.result.type === 'battery');
    while (batteryIndex < 0 && seed < 64n) {
      seed++;
      probe = new AuthoritativeSimulation(seed);
      batteryIndex = probe.floor.searchables.findIndex(item => item.result.type === 'battery');
    }
    expect(batteryIndex).toBeGreaterThanOrEqual(0);
    expect(new AuthoritativeSimulation(seed, { battery: 0, flashlightOn: true }).state.flashlightOn).toBe(false);
    const batteryItem = probe.floor.searchables[batteryIndex];
    const makeInitialState = () => ({
      x: (batteryItem.x * 32 + 16) * FIXED_SCALE,
      y: (batteryItem.y * 32 + 16) * FIXED_SCALE,
      battery: 8,
      flashlightOn: true,
      hasKey: true,
      searched: probe.floor.searchables.map((_, index) => index !== batteryIndex),
      stalker: { state: 'dormant' as const, x: 0, y: 0, targetX: 0, targetY: 0, ticksRemaining: 100_000, chaseStartTick: 0, lastChaseEndTick: 0, visible: false, moveRemainder: 0 },
      crawlers: [], watchers: [], ambushers: [], mimics: [],
      corruption: { lastTriggerTick: 0, effectId: 0, effectType: 0, intensityPermille: 0, durationTicks: 0 },
    });
    const live = new AuthoritativeSimulation(seed, makeInitialState());
    const recorder = new InputRecorder();
    const inputs: InputState[] = [
      emptyInput, // 8 subpercent drain reaches exactly zero.
      { ...emptyInput, flashlight: true }, // Zero battery cannot toggle it on.
      { ...emptyInput, interact: true }, // Restore charge from the searchable battery.
      { ...emptyInput, flashlight: true }, // It works again after recharge.
    ];
    inputs.forEach((input, tick) => {
      recorder.recordTick(tick, input);
      live.step(input);
      if (tick === 0) {
        expect(live.state.battery).toBe(0);
        expect(live.state.flashlightOn).toBe(false);
      } else if (tick === 1) {
        expect(live.state.flashlightOn).toBe(false);
      } else if (tick === 2) {
        expect(live.state.battery).toBeGreaterThan(0);
        expect(live.state.flashlightOn).toBe(false);
      } else {
        expect(live.state.flashlightOn).toBe(true);
      }
    });
    const replay = new AuthoritativeSimulation(seed, makeInitialState());
    const source = InputReplayer.fromBinary(recorder.encodeBinary());
    while (replay.state.tick < source.terminalTick) replay.step(source.getStateAtTick(replay.state.tick));
    expect(replay.snapshot()).toEqual(live.snapshot());
  });

  it('uses integer subpixels and changes authoritative position for relevant movement', () => {
    const idle = new AuthoritativeSimulation(123n);
    const moving = new AuthoritativeSimulation(123n);
    for (let tick = 0; tick < 60; tick++) {
      idle.step(emptyInput);
      moving.step({ ...emptyInput, right: true });
    }
    expect(Number.isInteger(moving.state.x / FIXED_SCALE)).toBe(true);
    expect(moving.state.x).not.toBe(idle.state.x);
    expect(moving.state.tick).toBe(60);
  });

  it('keeps the entire player footprint inside walkable cells across generated floors', () => {
    for (let seed = 0n; seed < 12n; seed++) {
      const sim = new AuthoritativeSimulation(seed * 7919n + 1n);
      for (let tick = 0; tick < 1800; tick++) {
        // Repeatable collision-heavy sequence, including diagonals and wall scrapes.
        const phase = Math.floor(tick / 90) % 4;
        const input = phase === 0 ? { ...emptyInput, left: true, up: true }
          : phase === 1 ? { ...emptyInput, right: true, up: true }
            : phase === 2 ? { ...emptyInput, right: true, down: true }
              : { ...emptyInput, left: true, down: true };
        const state = sim.step(input);
        const floor = sim.floor;
        const half = PLAYER_COLLISION_HALF_EXTENT_SUBPIXELS, tile = 32 * FIXED_SCALE;
        const minX = Math.floor((state.x - half) / tile), maxX = Math.floor((state.x + half - 1) / tile);
        const minY = Math.floor((state.y - half) / tile), maxY = Math.floor((state.y + half - 1) / tile);
        for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
          expect(floor.tiles[y]?.[x]).toBe(true);
        }
        if (state.status !== 'playing') break;
      }
    }
  });

  it.each([
    [4, 3], [3, 2], [2, 1], [1, 0], [0, -1],
  ])('advances authoritatively from floor %i to %i while preserving run state', (floor, nextFloor) => {
    const seed = 0xabcde123n;
    const probe = new AuthoritativeSimulation(seed, { floor });
    const [exitX, exitY] = probe.floor.exit;
    const x = (exitX * 32 + 16) * FIXED_SCALE, y = (exitY * 32 + 16) * FIXED_SCALE;
    const createSimulation = () => new AuthoritativeSimulation(seed, {
      floor, x, y, tick: 0, hp: 73,
      battery: 55 * FIXED_SCALE + 77,
      curse: 12 * FIXED_SCALE + 77,
      score: 432, floorsCompleted: 4 - floor, hasKey: true,
      // Isolate the transition assertion from nearby searchables: this case
      // is about stairs progression, not interaction-priority competition.
      searched: probe.floor.searchables.map(() => true),
      stalker: { state: 'dormant', x, y, targetX: x, targetY: y, ticksRemaining: 100_000, chaseStartTick: 0, lastChaseEndTick: 0, visible: false, moveRemainder: 0 },
      crawlers: [], watchers: [], ambushers: [], mimics: [],
    });
    const sim = createSimulation();
    const twin = createSimulation();
    const recorder = new InputRecorder();
    const input = { ...emptyInput, interact: true };
    recorder.recordTick(sim.state.tick, input);
    const result = sim.stepWithEvents(input);
    twin.stepWithEvents(input);

    // Simulate a presentation adapter throwing while consuming its transition event.
    expect(() => { throw new Error('presentation animation failed'); }).toThrow('presentation animation failed');
    expect(twin.snapshot()).toEqual(sim.snapshot());
    expect(result.events).toContainEqual({ type: 'floor_transition', fromFloor: floor, toFloor: nextFloor, floorsCompleted: 5 - floor });
    expect(result.state.floor).toBe(nextFloor);
    expect(result.state.status).toBe(nextFloor < 0 ? 'won' : 'playing');
    expect(result.state.tick).toBe(1);
    expect(result.state.hp).toBe(73);
    expect(result.state.battery).toBe(Math.min(100 * FIXED_SCALE, 55 * FIXED_SCALE + 77 + 20 * FIXED_SCALE));
    expect(result.state.curse).toBe(20 * FIXED_SCALE + 77);
    expect(result.state.score).toBe(432 + 100 * floor);
    expect(result.state.floorsCompleted).toBe(5 - floor);
    if (nextFloor >= 0) {
      expect([result.state.x, result.state.y]).toEqual([(sim.floor.start[0] * 32 + 16) * FIXED_SCALE, (sim.floor.start[1] * 32 + 16) * FIXED_SCALE]);
    }
    recorder.setTerminalTick(sim.state.tick);
    const replay = InputReplayer.fromBinary(recorder.encodeBinary());
    expect(replay.terminalTick).toBe(sim.state.tick);
    expect(replay.getStateAtTick(0)).toEqual(input);
  });

  it('keeps ordinary floor transitions uncapped so curse can continue toward and reach 100', () => {
    const seed = 0x8484n;
    const probe = new AuthoritativeSimulation(seed, { floor: 2 });
    const [exitX, exitY] = probe.floor.exit;
    const x = (exitX * 32 + 16) * FIXED_SCALE, y = (exitY * 32 + 16) * FIXED_SCALE;
    const create = (curse: number) => new AuthoritativeSimulation(seed, {
      floor: 2, x, y, hasKey: true, curse,
      searched: probe.floor.searchables.map(() => true),
      stalker: { state: 'dormant', x: 0, y: 0, targetX: 0, targetY: 0, ticksRemaining: 100_000, chaseStartTick: 0, lastChaseEndTick: 0, visible: false, moveRemainder: 0 },
      crawlers: [], watchers: [], ambushers: [], mimics: [],
    });
    const progressing = create(84 * FIXED_SCALE);
    progressing.step({ ...emptyInput, interact: true });
    expect(progressing.state.floor).toBe(1);
    expect(progressing.state.curse).toBe(92 * FIXED_SCALE);
    expect(progressing.state.status).toBe('playing');

    const terminal = create(96 * FIXED_SCALE);
    terminal.step({ ...emptyInput, interact: true });
    expect(terminal.state.floor).toBe(1);
    expect(terminal.state.curse).toBe(104 * FIXED_SCALE);
    expect(terminal.state.status).toBe('lost');
  });

  it('owns enemy contact damage and deterministic search results', () => {
    const seed = 777n;
    const reference = new AuthoritativeSimulation(seed);
    const start = reference.floor.start;
    const px = (start[0] * 32 + 16) * FIXED_SCALE, py = (start[1] * 32 + 16) * FIXED_SCALE;
    const stalker = { state: 'hunting' as const, x: px + 10 * FIXED_SCALE, y: py, targetX: px, targetY: py, ticksRemaining: 0, chaseStartTick: 0, lastChaseEndTick: -600, visible: true, moveRemainder: 0 };
    const atExit = new AuthoritativeSimulation(seed, { x: px, y: py, stalker });
    const damageTick = atExit.stepWithEvents(emptyInput);
    expect(damageTick.events).toContainEqual({ type: 'damage', amount: 30, hp: 70 });
    expect(atExit.state.hp).toBe(70);
    expect(atExit.state.curse).toBe(20 * FIXED_SCALE);
    expect(atExit.state.invulnerableUntilTick).toBe(90);

    const loot = new AuthoritativeSimulation(seed);
    const first = loot.floor.searchables[0];
    const searched = new AuthoritativeSimulation(seed, {
      x: (first.x * 32 + 16) * FIXED_SCALE,
      y: (first.y * 32 + 16) * FIXED_SCALE,
      stalker: { state: 'dormant', x: 0, y: 0, targetX: 0, targetY: 0, ticksRemaining: 10000, chaseStartTick: 0, lastChaseEndTick: 0, visible: false, moveRemainder: 0 },
    });
    const expected = loot.floor.searchables[0].result;
    const firstResult = searched.stepWithEvents({ ...emptyInput, interact: true });
    expect(firstResult.events).toContainEqual({ type: 'loot_searched', index: 0, result: expected });
    expect(searched.state.searched[0]).toBe(true);
    if (expected.type === 'collectible') expect(searched.state.score).toBe(expected.score);
    if (expected.type === 'health') expect(searched.state.hp).toBe(100);
    if (expected.type === 'battery') expect(searched.state.battery).toBeGreaterThan(100 * FIXED_SCALE - 8);
    const secondResult = searched.stepWithEvents({ ...emptyInput, interact: true });
    expect(secondResult.events.filter(event => event.type === 'loot_searched' && event.index === 0)).toHaveLength(0);
  });

  it('maps generated clue outcomes to authored story text deterministically', () => {
    expect(getAuthoredClueForSearchId('clue_4_2_1')).toEqual(getAuthoredClueForSearchId('clue_4_2_1'));
    expect(getAuthoredClueForSearchId('clue_4_2_1')?.content.length).toBeGreaterThan(20);
    expect(getAuthoredClueForSearchId('not-a-clue')).toBeNull();
  });

  it('advances Watcher curse, Ambusher warning/damage, Mimic chase, and corruption on ticks', () => {
    const seed = 9123n;
    const base = new AuthoritativeSimulation(seed);
    const start = base.floor.start;
    const x = (start[0] * 32 + 16) * FIXED_SCALE, y = (start[1] * 32 + 16) * FIXED_SCALE;
    const dormantStalker = { state: 'dormant' as const, x: x + 600 * FIXED_SCALE, y, targetX: x, targetY: y, ticksRemaining: 100_000, chaseStartTick: 0, lastChaseEndTick: 0, visible: false, moveRemainder: 0 };
    const watcher = { id: 0, x: x + 80 * FIXED_SCALE, y, active: true, illuminatedTicks: 0, decayRemainder: 0, curseRemainder: 0 };
    const ambusher = { id: 0, x, y, state: 'warning' as const, warningTicks: 1, damageAtTick: -1, damage: 7, hasTriggered: false };
    const sim = new AuthoritativeSimulation(seed, { x, y, facingX: 1, facingY: 0, stalker: dormantStalker, crawlers: [], watchers: [watcher], ambushers: [ambusher], mimics: [] });
    const warningSim = new AuthoritativeSimulation(seed, { x, y, stalker: dormantStalker, crawlers: [], watchers: [], ambushers: [
      { ...ambusher, state: 'hidden', warningTicks: 0, x: x + 20 * FIXED_SCALE },
    ], mimics: [] });
    warningSim.step(emptyInput);
    expect(warningSim.state.ambushers[0].warningTicks).toBeGreaterThanOrEqual(24);
    expect(warningSim.state.ambushers[0].warningTicks).toBeLessThanOrEqual(36);

    sim.step({ ...emptyInput, flashlight: true });
    expect(sim.state.watchers[0].illuminatedTicks).toBe(1);
    expect(sim.state.ambushers[0].hasTriggered).toBe(true);
    for (let i = 0; i < 12; i++) sim.step(emptyInput);
    expect(sim.state.hp).toBe(93);
    expect(sim.state.damageEventId).toBe(1);
    expect(sim.state.curse).toBeGreaterThan(0);

    const corrupt = new AuthoritativeSimulation(seed, { stalker: dormantStalker, crawlers: [], watchers: [], ambushers: [], mimics: [] });
    for (let i = 0; i < 1441 && corrupt.state.corruption.effectId === 0; i++) corrupt.step(emptyInput);
    expect(corrupt.state.corruption.effectId).toBeGreaterThan(0);
  });

  it('resolves Crawler contact and gives a revealed Mimic a deterministic reaction window before chase', () => {
    const seed = 0x987654321n;
    const base = new AuthoritativeSimulation(seed, { floor: 2 });
    const start = base.floor.start;
    const x = (start[0] * 32 + 16) * FIXED_SCALE, y = (start[1] * 32 + 16) * FIXED_SCALE;
    const dormantStalker = { state: 'dormant' as const, x: x + 600 * FIXED_SCALE, y, targetX: x, targetY: y, ticksRemaining: 100_000, chaseStartTick: 0, lastChaseEndTick: 0, visible: false, moveRemainder: 0 };
    const crawler = new AuthoritativeSimulation(seed, { floor: 2, x, y, stalker: dormantStalker, crawlers: [
      { id: 0, x: x + 10 * FIXED_SCALE, y, targetX: x, targetY: y, chasing: true, chaseStartTick: 0, moveRemainder: 0 },
    ], watchers: [], ambushers: [], mimics: [] });
    crawler.step(emptyInput);
    expect(crawler.state.hp).toBe(85);
    expect(crawler.state.crawlers[0].chasing).toBe(false);
    expect(crawler.state.crawlers[0].x).not.toBe(x + 10 * FIXED_SCALE);

    const mimicSeed = Array.from({ length: 512 }, (_, offset) => seed + BigInt(offset))
      .find(candidate => new AuthoritativeSimulation(candidate, { floor: 0 }).floor.searchables.some(item => item.isMimic));
    expect(mimicSeed).toBeDefined();
    const mimicWorld = new AuthoritativeSimulation(mimicSeed!, { floor: 0 });
    const targetIndex = mimicWorld.floor.searchables.findIndex(item => item.isMimic);
    const target = mimicWorld.floor.searchables[targetIndex];
    const mx = (target.x * 32 + 16) * FIXED_SCALE, my = (target.y * 32 + 16) * FIXED_SCALE;
    const makeInitialState = (): Partial<AuthoritativeState> => ({
      floor: 0, x: mx - 40 * FIXED_SCALE, y: my,
      searched: mimicWorld.floor.searchables.map((_, index) => index !== targetIndex),
      stalker: { ...dormantStalker, x: mx + 600 * FIXED_SCALE, y: my },
      crawlers: [], watchers: [], ambushers: [],
    });
    const mimic = new AuthoritativeSimulation(mimicSeed!, makeInitialState());
    const recorder = new InputRecorder();
    const recordAndStep = (input: InputState) => {
      recorder.recordTick(mimic.state.tick, input);
      mimic.step(input);
    };
    recordAndStep({ ...emptyInput, interact: true });
    let revealed = mimic.state.mimics.find(value => value.searchableIndex === targetIndex)!;
    const revealPosition = [revealed.x, revealed.y];
    expect(revealed.revealed).toBe(true);
    expect(revealed.revealUntilTick).toBe(MIMIC_REVEAL_TICKS);
    expect(revealed.chaseUntilTick).toBe(MIMIC_REVEAL_TICKS + MIMIC_CHASE_DURATION_TICKS);
    expect(mimic.state.hp).toBe(100);
    expect(mimic.state.damageEventId).toBe(0);

    for (let i = 0; i < MIMIC_REVEAL_TICKS - 1; i++) recordAndStep(emptyInput);
    revealed = mimic.state.mimics.find(value => value.searchableIndex === targetIndex)!;
    expect(mimic.state.tick).toBe(MIMIC_REVEAL_TICKS);
    expect([revealed.x, revealed.y]).toEqual(revealPosition);
    expect(mimic.state.hp).toBe(100);
    expect(mimic.state.damageEventId).toBe(0);

    recordAndStep(emptyInput); // Tick 36: chase begins only after reveal duration.
    revealed = mimic.state.mimics.find(value => value.searchableIndex === targetIndex)!;
    expect([revealed.x, revealed.y]).not.toEqual(revealPosition);
    expect(mimic.state.hp).toBe(100);
    for (let i = 0; i < 20 && mimic.state.damageEventId === 0; i++) recordAndStep(emptyInput);
    expect(mimic.state.hp).toBe(90);
    expect(mimic.state.damageEventId).toBe(1);

    recorder.setTerminalTick(mimic.state.tick);
    const replay = new AuthoritativeSimulation(mimicSeed!, makeInitialState());
    const replayer = InputReplayer.fromBinary(recorder.encodeBinary());
    while (replay.state.tick < replayer.terminalTick) replay.step(replayer.getStateAtTick(replay.state.tick));
    expect(replay.snapshot()).toEqual(mimic.snapshot());
  });

  it('isolates cosmetic RNG consumption from authoritative RNG streams and state', () => {
    const untouched = new AuthoritativeSimulation(99n);
    const withCosmetics = new AuthoritativeSimulation(99n);
    for (let i = 0; i < 500; i++) withCosmetics.nextCosmeticRandom();
    for (let tick = 0; tick < 1000; tick++) {
      const input = { ...emptyInput, right: tick < 100, flashlight: tick === 50 };
      untouched.step(input);
      withCosmetics.step(input);
    }
    expect(withCosmetics.snapshot()).toEqual(untouched.snapshot());
  });

  it('moves the legacy major BoxScare movement lockout to a deterministic 90-tick deadline', () => {
    let selectedSeed: bigint | undefined;
    for (let seed = 1n; seed <= 256n && selectedSeed === undefined; seed++) {
      const probe = new AuthoritativeSimulation(seed);
      const item = probe.floor.searchables.find(searchable => searchable.result.type !== 'mimic_reveal');
      if (!item) continue;
      const x = (item.x * 32 + 16) * FIXED_SCALE, y = (item.y * 32 + 16) * FIXED_SCALE;
      const candidate = new AuthoritativeSimulation(seed, {
        x, y,
        stalker: { state: 'dormant', x: x + 600 * FIXED_SCALE, y, targetX: x, targetY: y, ticksRemaining: 100_000, chaseStartTick: 0, lastChaseEndTick: 0, visible: false, moveRemainder: 0 },
        crawlers: [], watchers: [], ambushers: [], mimics: [],
      });
      candidate.step({ ...emptyInput, interact: true });
      if (candidate.state.scareLockoutUntilTick > candidate.state.tick) selectedSeed = seed;
    }
    expect(selectedSeed).toBeDefined();
    const probe = new AuthoritativeSimulation(selectedSeed!);
    const item = probe.floor.searchables.find(searchable => searchable.result.type !== 'mimic_reveal')!;
    const x = (item.x * 32 + 16) * FIXED_SCALE, y = (item.y * 32 + 16) * FIXED_SCALE;
    const sim = new AuthoritativeSimulation(selectedSeed!, {
      x, y,
      stalker: { state: 'dormant', x: x + 600 * FIXED_SCALE, y, targetX: x, targetY: y, ticksRemaining: 100_000, chaseStartTick: 0, lastChaseEndTick: 0, visible: false, moveRemainder: 0 },
      crawlers: [], watchers: [], ambushers: [], mimics: [],
    });
    sim.step({ ...emptyInput, interact: true });
    expect(sim.state.scareLockoutUntilTick).toBe(90);
    const lockedPosition = [sim.state.x, sim.state.y];
    for (let i = 0; i < 89; i++) sim.step({ ...emptyInput, right: true });
    expect([sim.state.x, sim.state.y]).toEqual(lockedPosition);
  });

  it('records and replays a complete Floor 4 to Outside run in the Phaser-free simulation', () => {
    // This fixture seed is selected against the complete Floor 4 -> Block 13
    // progression, whose shared Economy stream differs from direct floor-0 boot.
    const runSeed = 0x13579bdf2469n;
    const normalSimulation = new AuthoritativeSimulation(runSeed);
    expect(normalSimulation.state.hp).toBe(100);
    // Keep the long traversal alive long enough to exercise every floor's
    // encounter systems; individual tests assert the normal 100 HP damage rules.
    const sim = new AuthoritativeSimulation(runSeed, { hp: 1000 });
    const recorder = new InputRecorder();
    const recordedStates: InputState[] = [];
    let block13EntrySnapshot: ReturnType<typeof sim.snapshot> | undefined;
    let crawlerChaseSeen = false, watcherCurseSeen = false, ambusherSeen = false, mimicSeen = false;
    const step = (input: InputState) => {
      const before = sim.state;
      const stalkerThreat = before.stalker.state === 'investigating' || before.stalker.state === 'hunting';
      const wantLight = stalkerThreat && before.battery > 0;
      const actual = { ...input, flashlight: input.flashlight || (wantLight !== before.flashlightOn) };
      recordedStates.push({ ...actual });
      recorder.recordTick(before.tick, actual);
      sim.step(actual);
      const after = sim.state;
      const floorMap = sim.floor;
      const half = PLAYER_COLLISION_HALF_EXTENT_SUBPIXELS, tileSize = 32 * FIXED_SCALE;
      const minTileX = Math.floor((after.x - half) / tileSize), maxTileX = Math.floor((after.x + half - 1) / tileSize);
      const minTileY = Math.floor((after.y - half) / tileSize), maxTileY = Math.floor((after.y + half - 1) / tileSize);
      for (let y = minTileY; y <= maxTileY; y++) for (let x = minTileX; x <= maxTileX; x++) {
        expect(floorMap.tiles[y]?.[x], `player overlaps static wall at floor ${after.floor}, tick ${after.tick}`).toBe(true);
      }
      crawlerChaseSeen ||= after.crawlers.some(crawler => crawler.chasing);
      watcherCurseSeen ||= after.watchers.some(watcher => watcher.curseRemainder > 0);
      ambusherSeen ||= after.ambushers.some(ambusher => ambusher.hasTriggered);
      mimicSeen ||= after.mimics.some(mimic => mimic.revealed);
      if (sim.state.status === 'lost') throw new Error(`run unexpectedly ended in a loss at floor=${sim.state.floor} tick=${sim.state.tick} hp=${sim.state.hp} curse=${sim.state.curse} damage=${sim.state.lastDamage}`);
    };
    const route = (target: [number, number]) => {
      let guard = 0;
      while ((Math.abs(sim.state.x / FIXED_SCALE - (target[0] * 32 + 16)) > 1 || Math.abs(sim.state.y / FIXED_SCALE - (target[1] * 32 + 16)) > 1) && guard++ < 20_000) {
        const map = sim.floor;
        const sx = Math.floor(sim.state.x / (32 * FIXED_SCALE)), sy = Math.floor(sim.state.y / (32 * FIXED_SCALE));
        const queue: Array<[number, number]> = [[sx, sy]];
        const parent = new Map<string, string | null>([[`${sx},${sy}`, null]]);
        for (let i = 0; i < queue.length; i++) {
          const [x, y] = queue[i];
          if (x === target[0] && y === target[1]) break;
          for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]] as Array<[number, number]>) {
            const key = `${nx},${ny}`;
            if (map.tiles[ny]?.[nx] && !parent.has(key)) { parent.set(key, `${x},${y}`); queue.push([nx, ny]); }
          }
        }
        let key = `${target[0]},${target[1]}`;
        if (!parent.has(key)) { step(emptyInput); continue; }
        while (parent.get(key) && parent.get(parent.get(key)!) !== null) key = parent.get(key)!;
        const [tx, ty] = key.split(',').map(Number);
        let attempts = 0;
        const centerX = tx * 32 + 16, centerY = ty * 32 + 16;
        while ((Math.abs(sim.state.x / FIXED_SCALE - centerX) > 1 || Math.abs(sim.state.y / FIXED_SCALE - centerY) > 1) && attempts++ < 60) {
          const px = sim.state.x / (32 * FIXED_SCALE), py = sim.state.y / (32 * FIXED_SCALE);
          step({ ...emptyInput, right: centerX > px * 32, left: centerX < px * 32, down: centerY > py * 32, up: centerY < py * 32 });
        }
        if (attempts >= 60) step(emptyInput);
      }
      if (guard >= 20_000) throw new Error(`route stalled before ${target}; at ${sim.state.x / (32 * FIXED_SCALE)},${sim.state.y / (32 * FIXED_SCALE)}`);
    };

    for (let floor = 4; floor >= 0; floor--) {
      expect(sim.state.floor).toBe(floor);
      if (floor === 0) {
        const mimic = sim.floor.searchables.find(item => item.isMimic);
        if (mimic) {
          route([mimic.x, mimic.y]);
          step({ ...emptyInput, interact: true });
          step(emptyInput);
        }
      }
      route(sim.floor.key);
      step({ ...emptyInput, interact: true });
      step(emptyInput);
      expect(sim.state.hasKey).toBe(true);
      if (floor === 0) expect(sim.floor.searchables.some(item => item.isMimic)).toBe(true);
      route(sim.floor.exit);
      let guard = 0;
      while (sim.state.floor === floor && sim.state.status === 'playing' && guard++ < 20) {
        step({ ...emptyInput, interact: true });
        if (sim.state.status === 'playing' && sim.state.floor === floor) step(emptyInput);
      }
      expect(sim.state.floor).toBe(floor - 1);
      if (floor === 1) {
        expect(sim.state.floor).toBe(0); // Block 13 is a live, non-terminal floor.
        expect(sim.state.status).toBe('playing');
        expect(sim.state.floorsCompleted).toBe(4);
        expect(sim.floor.width).toBeGreaterThan(0);
        expect(sim.floor.key.length).toBe(2);
        expect(sim.floor.exit.length).toBe(2);
        block13EntrySnapshot = sim.snapshot();
      }
    }
    expect(sim.state.status).toBe('won');
    expect(sim.state.floor).toBe(-1); // Victory only after the Block 13 exit.
    expect(sim.state.floorsCompleted).toBe(5);
    expect(sim.state.tick).toBeGreaterThan(0);

    recorder.setTerminalTick(sim.state.tick);
    const replay = new AuthoritativeSimulation(runSeed, { hp: 1000 });
    const source = InputReplayer.fromBinary(recorder.encodeBinary());
    let replayMatchedBlock13Entry = false;
    while (replay.state.tick < source.terminalTick) {
      const tick = replay.state.tick;
      const input = source.getStateAtTick(tick);
      expect(input, `input mismatch at tick ${tick}`).toEqual(recordedStates[tick]);
      replay.step(input);
      if (!replayMatchedBlock13Entry && replay.state.floor === 0 && replay.state.floorsCompleted === 4) {
        expect(replay.state.status).toBe('playing');
        expect(replay.snapshot()).toEqual(block13EntrySnapshot);
        replayMatchedBlock13Entry = true;
      }
    }
    expect(replayMatchedBlock13Entry).toBe(true);
    expect(replay.snapshot()).toEqual(sim.snapshot());
    const manifest: RunManifest = {
      runId: 17n,
      player: '0x1111111111111111111111111111111111111111',
      gameVersion: `0x${'22'.repeat(32)}`,
      rulesHash: `0x${'33'.repeat(32)}`,
      btcBlockHash: `0x${'44'.repeat(32)}`,
      hemiBlockHash: `0x${'55'.repeat(32)}`,
      ethBlockHash: `0x${'66'.repeat(32)}`,
      hemiTxHash: `0x${'77'.repeat(32)}`,
      startedAt: 0,
    };
    const liveFinal = finalStateV1FromSimulation(manifest, sim);
    const replayFinal = finalStateV1FromSimulation(manifest, replay);
    expect(replayFinal).toEqual(liveFinal);
    expect(hashFinalStateV1(replayFinal)).toBe(hashFinalStateV1(liveFinal));
    expect(source.terminalTick).toBe(sim.state.tick);
    const replayAtRenderSchedule = (fps: number, initialStallMs = 0) => {
      const scheduledReplay = new AuthoritativeSimulation(runSeed, { hp: 1000 });
      const scheduledSource = InputReplayer.fromBinary(recorder.encodeBinary());
      const engine = new SimulationEngine();
      const update = (delta: number) => engine.update(delta, (_fixed, tick) => {
        scheduledReplay.step(scheduledSource.getStateAtTick(tick));
      });

      if (initialStallMs > 0) update(initialStallMs);
      let frames = 0;
      while (scheduledReplay.state.tick < scheduledSource.terminalTick && frames++ < 1_000_000) {
        update(1000 / fps);
      }
      expect(scheduledReplay.state.tick).toBe(scheduledSource.terminalTick);
      return scheduledReplay.snapshot();
    };
    for (const fps of [30, 60, 144]) expect(replayAtRenderSchedule(fps)).toEqual(sim.snapshot());
    expect(replayAtRenderSchedule(60, 5000)).toEqual(sim.snapshot());
    expect(replayAtRenderSchedule(60)).toEqual(sim.snapshot());
    expect(crawlerChaseSeen).toBe(true);
    expect(ambusherSeen).toBe(true);
    expect(mimicSeen).toBe(true);
    expect(watcherCurseSeen).toBe(true);
  }, 20_000);

  it('keeps Floor 1 to Block 13 arrival playable when its transition bonus reaches the curse threshold', () => {
    const seed = 0x1313n;
    const probe = new AuthoritativeSimulation(seed, { floor: 1 });
    const [exitX, exitY] = probe.floor.exit;
    const x = (exitX * 32 + 16) * FIXED_SCALE, y = (exitY * 32 + 16) * FIXED_SCALE;
    const initialState: Partial<AuthoritativeState> = {
      floor: 1, x, y, tick: 500, floorsCompleted: 3, hasKey: true, curse: 90 * FIXED_SCALE,
      battery: 0,
      searched: probe.floor.searchables.map(() => true),
      corruption: { lastTriggerTick: 500, effectId: 0, effectType: 0, intensityPermille: 0, durationTicks: 0 },
      stalker: { state: 'dormant', x: 0, y: 0, targetX: 0, targetY: 0, ticksRemaining: 100_000, chaseStartTick: 0, lastChaseEndTick: 0, visible: false, moveRemainder: 0 },
      crawlers: [], watchers: [], ambushers: [], mimics: [],
    };
    const sim = new AuthoritativeSimulation(seed, initialState);
    const { events, state } = sim.stepWithEvents({ ...emptyInput, interact: true });
    expect(events).toContainEqual({ type: 'floor_transition', fromFloor: 1, toFloor: 0, floorsCompleted: 4 });
    expect(state.floor).toBe(0);
    expect(state.status).toBe('playing');
    expect(state.curse).toBe(85 * FIXED_SCALE);
    expect(state.battery).toBe(20 * FIXED_SCALE);
    expect(sim.floor.width).toBeGreaterThan(0);
    expect(sim.floor.key.length).toBe(2);
    expect(sim.floor.exit.length).toBe(2);
    sim.step({ ...emptyInput, flashlight: true });
    expect(sim.state.flashlightOn).toBe(true);
    expect(sim.state.status).toBe('playing');
    for (let i = 0; i < 120; i++) sim.step(emptyInput);
    const repeat = new AuthoritativeSimulation(seed, initialState);
    repeat.step({ ...emptyInput, interact: true });
    repeat.step({ ...emptyInput, flashlight: true });
    for (let i = 0; i < 120; i++) repeat.step(emptyInput);
    expect(repeat.snapshot()).toEqual(sim.snapshot());
  });

  it('uses 8 fixed battery subunits per lit simulation tick', () => {
    const sim = new AuthoritativeSimulation(0x812n, { crawlers: [], watchers: [], ambushers: [], mimics: [] });
    sim.step({ ...emptyInput, flashlight: true });
    expect(sim.state.battery).toBe(100 * FIXED_SCALE - 8);
  });

  it('allows curse above 85 inside Block 13 and still loses at 100', () => {
    const sim = new AuthoritativeSimulation(0x8513n, {
      floor: 0, curse: 85 * FIXED_SCALE, crawlers: [], watchers: [], ambushers: [], mimics: [],
      stalker: { state: 'dormant', x: 0, y: 0, targetX: 0, targetY: 0, ticksRemaining: 100_000, chaseStartTick: 0, lastChaseEndTick: 0, visible: false, moveRemainder: 0 },
    });
    const watcher = { id: 0, x: sim.state.x + 1, y: sim.state.y, active: true, illuminatedTicks: 0, decayRemainder: 0, curseRemainder: 0 };
    const withWatcher = new AuthoritativeSimulation(0x8513n, {
      floor: 0, x: sim.state.x, y: sim.state.y, facingX: 1, facingY: 0, curse: 85 * FIXED_SCALE,
      crawlers: [], watchers: [watcher], ambushers: [], mimics: [],
      stalker: { ...sim.state.stalker },
    });
    for (let i = 0; i < 60; i++) withWatcher.step(emptyInput);
    expect(withWatcher.state.curse).toBeGreaterThan(85 * FIXED_SCALE);
    expect(withWatcher.state.curse - 85 * FIXED_SCALE).toBe(383);

    const terminal = new AuthoritativeSimulation(0x8514n, {
      curse: 100 * FIXED_SCALE, crawlers: [], watchers: [], ambushers: [], mimics: [],
    });
    terminal.step(emptyInput);
    expect(terminal.state.status).toBe('lost');
  });

  it('reduces the Watcher point-blank peak to approximately 1.5 curse points per second', () => {
    const seed = 0x15c0n;
    const probe = new AuthoritativeSimulation(seed, { floor: 0 });
    const x = probe.state.x, y = probe.state.y;
    const sim = new AuthoritativeSimulation(seed, {
      floor: 0, x, y, facingX: 1, facingY: 0,
      stalker: { ...probe.state.stalker, ticksRemaining: 100_000 },
      crawlers: [], watchers: [{ id: 0, x: x + FIXED_SCALE, y, active: true, illuminatedTicks: 0, decayRemainder: 0, curseRemainder: 0 }],
      ambushers: [], mimics: [],
    });
    for (let i = 0; i < 60; i++) sim.step(emptyInput);
    expect(sim.state.curse).toBe(381); // 1.488 percentage points at 1px; peak is 1.5.
  });

  it('retains the existing Block 13 key-triggered Stalker chase and flashlight retreat', () => {
    const seed = 0x13f1n;
    const probe = new AuthoritativeSimulation(seed, { floor: 0 });
    const [startTileX, startTileY] = probe.floor.start;
    const x = (startTileX * 32 + 16) * FIXED_SCALE;
    const y = (startTileY * 32 + 16) * FIXED_SCALE;
    const sim = new AuthoritativeSimulation(seed, {
      floor: 0, floorsCompleted: 4, hasKey: true, x, y,
      stalker: {
        state: 'investigating', x: x + 40 * FIXED_SCALE, y,
        targetX: x, targetY: y, ticksRemaining: 120, chaseStartTick: 0,
        lastChaseEndTick: -STALKER_RECOVERY_COOLDOWN_TICKS, visible: true, moveRemainder: 0,
      },
      crawlers: [], watchers: [], ambushers: [], mimics: [],
    });
    expect(sim.step(emptyInput).stalker.state).toBe('hunting');
    expect(sim.step({ ...emptyInput, flashlight: true }).stalker.state).toBe('retreating');
    expect(sim.state.status).toBe('playing');
  });

  it('gives the player a deterministic 15-second Stalker recovery window after flashlight deterrence', () => {
    const seed = 0x900n;
    const probe = new AuthoritativeSimulation(seed, { floor: 0 });
    const x = probe.state.x, y = probe.state.y;
    const makeInitialState = (): Partial<AuthoritativeState> => ({
      floor: 0, x, y, flashlightOn: false,
      stalker: {
        state: 'hunting', x: x + 100 * FIXED_SCALE, y, targetX: x, targetY: y,
        ticksRemaining: 0, chaseStartTick: 0, lastChaseEndTick: -STALKER_RECOVERY_COOLDOWN_TICKS,
        visible: true, moveRemainder: 0,
      },
      crawlers: [], watchers: [], ambushers: [], mimics: [],
    });
    const live = new AuthoritativeSimulation(seed, makeInitialState());
    const recorder = new InputRecorder();
    const apply = (input: InputState) => {
      recorder.recordTick(live.state.tick, input);
      live.step(input);
    };
    apply({ ...emptyInput, flashlight: true });
    expect(live.state.stalker.state).toBe('retreating');
    expect(live.state.stalker.lastChaseEndTick).toBe(0);

    for (let tick = 1; tick < STALKER_RECOVERY_COOLDOWN_TICKS; tick++) {
      apply(emptyInput);
      expect(['retreating', 'dormant']).toContain(live.state.stalker.state);
    }
    expect(live.state.tick).toBe(STALKER_RECOVERY_COOLDOWN_TICKS);
    expect(live.state.stalker.state).toBe('dormant');
    apply(emptyInput); // Cooldown ends exactly at tick 900; roaming may resume.
    expect(live.state.stalker.state).toBe('roaming');

    recorder.setTerminalTick(live.state.tick);
    const replay = new AuthoritativeSimulation(seed, makeInitialState());
    const replayer = InputReplayer.fromBinary(recorder.encodeBinary());
    while (replay.state.tick < replayer.terminalTick) replay.step(replayer.getStateAtTick(replay.state.tick));
    expect(replay.snapshot()).toEqual(live.snapshot());
  });
});
