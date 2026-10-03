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
import { AuthoritativeSimulation, FIXED_SCALE, floorSeedFromCanonicalSeed } from '../src/core/authoritativeSimulation';
import { finalStateV1FromSimulation, hashFinalStateV1 } from '../src/core/finalStateV1';
import type { RunManifest } from '../src/core/seedDerivation';

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

  it('owns enemy contact damage and deterministic search results', () => {
    const seed = 777n;
    const reference = new AuthoritativeSimulation(seed);
    const start = reference.floor.start;
    const px = (start[0] * 32 + 16) * FIXED_SCALE, py = (start[1] * 32 + 16) * FIXED_SCALE;
    const stalker = { state: 'hunting' as const, x: px + 10 * FIXED_SCALE, y: py, targetX: px, targetY: py, ticksRemaining: 0, chaseStartTick: 0, lastChaseEndTick: -600, visible: true, moveRemainder: 0 };
    const atExit = new AuthoritativeSimulation(seed, { x: px, y: py, stalker });
    atExit.step(emptyInput);
    expect(atExit.state.hp).toBe(65);
    expect(atExit.state.curse).toBe(30 * FIXED_SCALE);
    expect(atExit.state.invulnerableUntilTick).toBe(90);

    const loot = new AuthoritativeSimulation(seed);
    const first = loot.floor.searchables[0];
    const searched = new AuthoritativeSimulation(seed, {
      x: (first.x * 32 + 16) * FIXED_SCALE,
      y: (first.y * 32 + 16) * FIXED_SCALE,
      stalker: { state: 'dormant', x: 0, y: 0, targetX: 0, targetY: 0, ticksRemaining: 10000, chaseStartTick: 0, lastChaseEndTick: 0, visible: false, moveRemainder: 0 },
    });
    const expected = loot.floor.searchables[0].result;
    searched.step({ ...emptyInput, interact: true });
    expect(searched.state.searched[0]).toBe(true);
    if (expected.type === 'collectible') expect(searched.state.score).toBe(expected.score);
    if (expected.type === 'health') expect(searched.state.hp).toBe(100);
    if (expected.type === 'battery') expect(searched.state.battery).toBeGreaterThan(100 * FIXED_SCALE - 9);
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

  it('resolves Crawler contact damage and Mimic reveal, chase, damage, and expiry authoritatively', () => {
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
    const mimic = new AuthoritativeSimulation(mimicSeed!, { floor: 0, x: mx, y: my, stalker: dormantStalker, crawlers: [], watchers: [], ambushers: [] });
    mimic.step({ ...emptyInput, interact: true });
    expect(mimic.state.mimics.find(value => value.searchableIndex === targetIndex)?.revealed).toBe(true);
    expect(mimic.state.hp).toBe(85);
    for (let i = 0; i < 91; i++) mimic.step(emptyInput);
    expect(mimic.state.damageEventId).toBeGreaterThan(1);
    for (let i = 0; i < 30; i++) mimic.step(emptyInput);
    expect(mimic.state.mimics.find(value => value.searchableIndex === targetIndex)?.active).toBe(false);
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
    const seed = Array.from({ length: 128 }, (_, offset) => 0x13579bdf2468n + BigInt(offset))
      .find(candidate => new AuthoritativeSimulation(candidate, { floor: 0 }).floor.searchables.some(item => item.isMimic));
    expect(seed).toBeDefined();
    const runSeed = seed!;
    const normalSimulation = new AuthoritativeSimulation(runSeed);
    expect(normalSimulation.state.hp).toBe(100);
    // Keep the long traversal alive long enough to exercise every floor's
    // encounter systems; individual tests assert the normal 100 HP damage rules.
    const sim = new AuthoritativeSimulation(runSeed, { hp: 1000 });
    const recorder = new InputRecorder();
    const recordedStates: InputState[] = [];
    let movingWallWasActive = false;
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
      movingWallWasActive ||= after.movingWallClosed;
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
        const blocked = new Set(sim.state.movingWalls.filter(wall => wall.active).flatMap(wall => wall.cells.map(([x, y]) => `${x},${y}`)));
        const queue: Array<[number, number]> = [[sx, sy]];
        const parent = new Map<string, string | null>([[`${sx},${sy}`, null]]);
        for (let i = 0; i < queue.length; i++) {
          const [x, y] = queue[i];
          if (x === target[0] && y === target[1]) break;
          for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]] as Array<[number, number]>) {
            const key = `${nx},${ny}`;
            if (map.tiles[ny]?.[nx] && !blocked.has(key) && !parent.has(key)) { parent.set(key, `${x},${y}`); queue.push([nx, ny]); }
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
      route(sim.floor.exit);
      let guard = 0;
      while (sim.state.floor === floor && sim.state.status === 'playing' && guard++ < 20) {
        step({ ...emptyInput, interact: true });
        if (sim.state.status === 'playing' && sim.state.floor === floor) step(emptyInput);
      }
      expect(sim.state.floor).toBe(floor - 1);
    }
    expect(sim.state.status).toBe('won');
    expect(sim.state.floorsCompleted).toBe(5);
    expect(sim.state.tick).toBeGreaterThan(0);

    recorder.setTerminalTick(sim.state.tick);
    const replay = new AuthoritativeSimulation(runSeed, { hp: 1000 });
    const source = InputReplayer.fromBinary(recorder.encodeBinary());
    while (replay.state.tick < source.terminalTick) {
      const tick = replay.state.tick;
      const input = source.getStateAtTick(tick);
      expect(input, `input mismatch at tick ${tick}`).toEqual(recordedStates[tick]);
      replay.step(input);
    }
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
    expect(sim.snapshot().state.movingWalls.length).toBeGreaterThan(0);
    expect(movingWallWasActive).toBe(true);
    expect(crawlerChaseSeen).toBe(true);
    expect(ambusherSeen).toBe(true);
    expect(mimicSeen).toBe(true);
    expect(watcherCurseSeen).toBe(true);
  }, 20_000);
});
