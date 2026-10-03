/**
 * Determinism Tests for Block 13 Replay System
 *
 * Tests that the game produces identical results when given:
 * - Same run manifest (blockchain entropy)
 * - Same input log
 *
 * Critical for verified replay system where off-chain verifiers
 * must reproduce exact game state to validate player performance.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../src/core/simulationEngine';
import { InputRecorder, InputReplayer, InputAction, type InputEvent } from '../src/core/inputRecorder';
import { initRNG, getWorldRNG, getEconomyRNG, getEventRNG } from '../src/core/rng';
import { PCG32 } from '../src/core/pcg32';
import type { RunManifest } from '../src/core/seedDerivation';

// Test manifest with deterministic seeds
const testManifest: RunManifest = {
  runId: 1n,
  player: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  gameVersion: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  rulesHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  btcBlockHash: '0x00000000000000000001234567890abcdef1234567890abcdef1234567890abc',
  hemiBlockHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  ethBlockHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  hemiTxHash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
  startedAt: 1704067200000, // 2024-01-01 00:00:00 UTC
};

describe('SimulationEngine - Fixed Timestep', () => {
  it('should run at consistent 60Hz regardless of input delta', () => {
    const engine1 = new SimulationEngine();
    const engine2 = new SimulationEngine();

    let ticks1 = 0;
    let ticks2 = 0;

    // Simulate 1 second with variable framerate
    // Engine 1: consistent 16ms
    for (let i = 0; i < 60; i++) {
      engine1.update(16.666, (delta, tick) => {
        ticks1++;
      });
    }

    // Engine 2: variable framerate (10-30ms)
    let elapsed = 0;
    while (elapsed < 1000) {
      const delta = [10, 20, 15, 25, 16, 30, 18][ticks2 % 7];
      elapsed += delta;
      engine2.update(delta, (delta, tick) => {
        ticks2++;
      });
    }

    // Both should have executed approximately 60 ticks
    expect(ticks1).toBeGreaterThanOrEqual(59);
    expect(ticks1).toBeLessThanOrEqual(61);
    expect(ticks2).toBeGreaterThanOrEqual(59);
    expect(ticks2).toBeLessThanOrEqual(61);
  });

  it('should provide consistent fixed delta in callback', () => {
    const engine = new SimulationEngine();
    const deltas: number[] = [];

    // Run with varying input delta
    for (let i = 0; i < 10; i++) {
      const inputDelta = [10, 20, 15, 25, 16, 30, 18][i % 7];
      engine.update(inputDelta, (fixedDelta, tick) => {
        deltas.push(fixedDelta);
      });
    }

    // All fixed deltas should be identical (16.666ms)
    const firstDelta = deltas[0];
    deltas.forEach(delta => {
      expect(delta).toBeCloseTo(firstDelta, 3);
    });
  });

  it('should convert time units correctly', () => {
    expect(SimulationEngine.msToTicks(1000)).toBe(60); // 1 second = 60 ticks
    expect(SimulationEngine.msToTicks(500)).toBe(30); // 0.5 seconds = 30 ticks
    expect(SimulationEngine.secToTicks(2)).toBe(120); // 2 seconds = 120 ticks

    expect(SimulationEngine.ticksToMs(60)).toBe(1000); // 60 ticks = 1 second
    expect(SimulationEngine.ticksToMs(30)).toBe(500); // 30 ticks = 0.5 seconds
    expect(SimulationEngine.ticksToSec(120)).toBe(2); // 120 ticks = 2 seconds
  });
});

describe('InputRecorder - Binary Encoding', () => {
  let recorder: InputRecorder;

  beforeEach(() => {
    recorder = new InputRecorder();
  });

  it('should only record state changes', () => {
    // Press right at tick 0
    recorder.recordTick(0, { left: false, right: true, up: false, down: false, flashlight: false, interact: false });

    // Hold right (no change) at tick 1-10
    for (let i = 1; i <= 10; i++) {
      recorder.recordTick(i, { left: false, right: true, up: false, down: false, flashlight: false, interact: false });
    }

    // Release right at tick 11
    recorder.recordTick(11, { left: false, right: false, up: false, down: false, flashlight: false, interact: false });

    const events = recorder.getEvents();

    // Should only record 2 events: press and release
    expect(events.length).toBe(2);
    expect(events[0]).toEqual({ tick: 0, action: InputAction.MOVE_RIGHT, state: true });
    expect(events[1]).toEqual({ tick: 11, action: InputAction.MOVE_RIGHT, state: false });
  });

  it('should encode and decode binary format correctly', () => {
    recorder.recordTick(0, { left: false, right: true, up: false, down: false, flashlight: false, interact: false });
    recorder.recordTick(45, { left: false, right: true, up: false, down: false, flashlight: true, interact: false });
    recorder.recordTick(120, { left: false, right: false, up: false, down: false, flashlight: false, interact: false });

    const binary = recorder.encodeBinary();
    const decoded = InputRecorder.decodeBinary(binary);

    expect(decoded).toEqual(recorder.getEvents());
  });

  it('preserves flashlight and interact impulses on adjacent ticks', () => {
    const pulse = { left: false, right: false, up: false, down: false, flashlight: true, interact: true };
    recorder.recordTick(4, pulse);
    recorder.recordTick(5, pulse);
    expect(recorder.getEvents()).toEqual([
      { tick: 4, action: InputAction.TOGGLE_FLASHLIGHT, state: true },
      { tick: 4, action: InputAction.INTERACT, state: true },
      { tick: 5, action: InputAction.TOGGLE_FLASHLIGHT, state: true },
      { tick: 5, action: InputAction.INTERACT, state: true },
    ]);
    const replay = InputReplayer.fromBinary(recorder.encodeBinary());
    expect(replay.getStateAtTick(4)).toEqual(pulse);
    expect(replay.getStateAtTick(5)).toEqual(pulse);
  });

  it('should produce consistent binary encoding', () => {
    const recorder1 = new InputRecorder();
    const recorder2 = new InputRecorder();

    // Record same inputs
    const inputs = { left: false, right: true, up: false, down: false, flashlight: false, interact: false };
    recorder1.recordTick(0, inputs);
    recorder2.recordTick(0, inputs);

    const binary1 = recorder1.encodeBinary();
    const binary2 = recorder2.encodeBinary();

    // Binary should be identical
    expect(binary1.length).toBe(binary2.length);
    expect(Array.from(binary1)).toEqual(Array.from(binary2));
  });

  it('should generate deterministic input hash from binary log', async () => {
    recorder.recordTick(0, { left: false, right: true, up: false, down: false, flashlight: false, interact: false });
    recorder.recordTick(45, { left: false, right: true, up: false, down: false, flashlight: true, interact: false });

    const hash1 = await recorder.generateInputHash();

    // Create new recorder with same inputs
    const recorder2 = new InputRecorder();
    recorder2.recordTick(0, { left: false, right: true, up: false, down: false, flashlight: false, interact: false });
    recorder2.recordTick(45, { left: false, right: true, up: false, down: false, flashlight: true, interact: false });

    const hash2 = await recorder2.generateInputHash();

    // Hashes must be identical
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', async () => {
    recorder.recordTick(0, { left: false, right: true, up: false, down: false, flashlight: false, interact: false });
    const hash1 = await recorder.generateInputHash();

    const recorder2 = new InputRecorder();
    recorder2.recordTick(0, { left: true, right: false, up: false, down: false, flashlight: false, interact: false });
    const hash2 = await recorder2.generateInputHash();

    expect(hash1).not.toBe(hash2);
  });
});

describe('InputReplayer - State Reconstruction', () => {
  it('should reconstruct input state from event log', () => {
    const events: InputEvent[] = [
      { tick: 0, action: InputAction.MOVE_RIGHT, state: true },
      { tick: 45, action: InputAction.TOGGLE_FLASHLIGHT, state: true },
      { tick: 120, action: InputAction.MOVE_RIGHT, state: false },
    ];

    const replayer = new InputReplayer(events);

    // Tick 0: right pressed
    const state0 = replayer.getStateAtTick(0);
    expect(state0.right).toBe(true);
    expect(state0.flashlight).toBe(false);

    // Tick 30: right still held
    const state30 = replayer.getStateAtTick(30);
    expect(state30.right).toBe(true);

    // Tick 45: flashlight toggled (momentary)
    const state45 = replayer.getStateAtTick(45);
    expect(state45.right).toBe(true);
    expect(state45.flashlight).toBe(true);

    // Tick 46: flashlight no longer pressed (toggle resets)
    const state46 = replayer.getStateAtTick(46);
    expect(state46.flashlight).toBe(false);

    // Tick 120: right released
    const state120 = replayer.getStateAtTick(120);
    expect(state120.right).toBe(false);
  });

  it('should handle out-of-order event processing', () => {
    // Events in wrong order
    const events: InputEvent[] = [
      { tick: 120, action: InputAction.MOVE_RIGHT, state: false },
      { tick: 0, action: InputAction.MOVE_RIGHT, state: true },
      { tick: 45, action: InputAction.TOGGLE_FLASHLIGHT, state: true },
    ];

    const replayer = new InputReplayer(events);

    // Should automatically sort by tick
    const state45 = replayer.getStateAtTick(45);
    expect(state45.right).toBe(true);
    expect(state45.flashlight).toBe(true);
  });
});

describe('RNG - Seeded Determinism', () => {
  beforeEach(() => {
    initRNG(testManifest);
  });

  it('should produce identical sequences with same manifest', () => {
    initRNG(testManifest);
    const worldRNG1 = getWorldRNG();
    const values1 = [
      worldRNG1.nextInt(),
      worldRNG1.nextInt(),
      worldRNG1.nextFloat(),
      worldRNG1.nextRange(0, 100),
    ];

    // Reinitialize with same manifest
    initRNG(testManifest);
    const worldRNG2 = getWorldRNG();
    const values2 = [
      worldRNG2.nextInt(),
      worldRNG2.nextInt(),
      worldRNG2.nextFloat(),
      worldRNG2.nextRange(0, 100),
    ];

    // Must be identical
    expect(values1).toEqual(values2);
  });

  it('should maintain independent RNG streams', () => {
    initRNG(testManifest);

    const worldValue1 = getWorldRNG().nextInt();
    const economyValue1 = getEconomyRNG().nextInt();
    const eventValue1 = getEventRNG().nextInt();

    // Reinitialize
    initRNG(testManifest);

    // World RNG should produce same value regardless of other RNG usage
    const worldValue2 = getWorldRNG().nextInt();
    expect(worldValue1).toBe(worldValue2);

    // Each RNG maintains its own state
    const economyValue2 = getEconomyRNG().nextInt();
    const eventValue2 = getEventRNG().nextInt();

    expect(economyValue1).toBe(economyValue2);
    expect(eventValue1).toBe(eventValue2);
  });

  it('should produce different values for different manifests', () => {
    initRNG(testManifest);
    const value1 = getWorldRNG().nextInt();

    const altManifest: RunManifest = {
      ...testManifest,
      btcBlockHash: '0x00000000000000000009876543210fedcba9876543210fedcba9876543210fe',
    };

    initRNG(altManifest);
    const value2 = getWorldRNG().nextInt();

    expect(value1).not.toBe(value2);
  });
});

describe('PCG32 - Core PRNG', () => {
  it('should be deterministic with same seed', () => {
    const rng1 = new PCG32(12345n);
    const rng2 = new PCG32(12345n);

    for (let i = 0; i < 100; i++) {
      expect(rng1.nextInt()).toBe(rng2.nextInt());
    }
  });

  it('should produce uniform distribution', () => {
    const rng = new PCG32(42n);
    const buckets = new Array(10).fill(0);
    const samples = 10000;

    for (let i = 0; i < samples; i++) {
      const value = rng.nextRange(0, 9);
      buckets[value]++;
    }

    // Each bucket should have roughly 1000 samples (±200 tolerance)
    buckets.forEach(count => {
      expect(count).toBeGreaterThan(800);
      expect(count).toBeLessThan(1200);
    });
  });

  it('should handle range boundaries correctly', () => {
    const rng = new PCG32(123n);

    for (let i = 0; i < 100; i++) {
      const value = rng.nextRange(0, 10);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(10);
    }
  });
});

describe('Full Determinism - Integration', () => {
  it('should produce identical results from same manifest + inputs', async () => {
    // Simulation 1
    initRNG(testManifest);
    const engine1 = new SimulationEngine();
    const recorder1 = new InputRecorder();

    let score1 = 0;
    let position1 = { x: 0, y: 0 };

    // Simulate 60 ticks with inputs
    for (let i = 0; i < 60; i++) {
      engine1.update(16.666, (delta, tick) => {
        const inputs = { left: false, right: tick < 30, up: false, down: false, flashlight: false, interact: false };
        recorder1.recordTick(tick, inputs);

        // Deterministic game logic
        if (inputs.right) position1.x += 2;
        score1 += getEconomyRNG().nextRange(1, 10);
      });
    }

    // Simulation 2 - same manifest and inputs
    initRNG(testManifest);
    const engine2 = new SimulationEngine();
    const recorder2 = new InputRecorder();

    let score2 = 0;
    let position2 = { x: 0, y: 0 };

    for (let i = 0; i < 60; i++) {
      engine2.update(16.666, (delta, tick) => {
        const inputs = { left: false, right: tick < 30, up: false, down: false, flashlight: false, interact: false };
        recorder2.recordTick(tick, inputs);

        if (inputs.right) position2.x += 2;
        score2 += getEconomyRNG().nextRange(1, 10);
      });
    }

    // Results must be identical
    expect(score1).toBe(score2);
    expect(position1).toEqual(position2);

    // Input hashes must match
    const hash1 = await recorder1.generateInputHash();
    const hash2 = await recorder2.generateInputHash();
    expect(hash1).toBe(hash2);
  });

  it('should handle replay with InputReplayer', () => {
    // Record a run
    initRNG(testManifest);
    const recorder = new InputRecorder();

    let originalScore = 0;

    // Record inputs for 60 ticks
    for (let tick = 0; tick < 60; tick++) {
      const inputs = { left: false, right: tick < 30, up: false, down: false, flashlight: tick === 45, interact: false };
      recorder.recordTick(tick, inputs);

      // Simulate gameplay
      originalScore += getEconomyRNG().nextRange(1, 10);
    }

    // Replay the run
    initRNG(testManifest);
    const replayer = new InputReplayer(recorder.getEvents());

    let replayScore = 0;

    for (let tick = 0; tick < 60; tick++) {
      const inputs = replayer.getStateAtTick(tick);

      // Same gameplay logic
      replayScore += getEconomyRNG().nextRange(1, 10);
    }

    // Scores must match
    expect(replayScore).toBe(originalScore);
  });

  it('should work across different framerates (fixed timestep)', () => {
    // The key insight: fixed timestep should produce identical simulation results
    // regardless of framerate, as long as the same simulation time elapses

    // Run at 60 FPS for 60 frames (999.96ms accumulated)
    initRNG(testManifest);
    const engine60 = new SimulationEngine();
    let score60 = 0;
    let ticks60 = 0;

    for (let i = 0; i < 60; i++) {
      engine60.update(16.666, (delta, tick) => {
        score60 += getEconomyRNG().nextRange(1, 10);
        ticks60++;
      });
    }

    // Run at variable framerate - accumulate the same total time
    initRNG(testManifest);
    const engineVar = new SimulationEngine();
    let scoreVar = 0;
    let ticksVar = 0;

    const deltas = [10, 20, 15, 25, 16, 30, 18];
    let i = 0;
    let accumulatedTime = 0;
    const targetTime = 60 * 16.666; // Match first simulation's total time

    while (accumulatedTime < targetTime) {
      const delta = deltas[i % deltas.length];
      accumulatedTime += delta;

      engineVar.update(delta, (delta, tick) => {
        scoreVar += getEconomyRNG().nextRange(1, 10);
        ticksVar++;
      });

      i++;
    }

    // Ticks might differ by 1 due to floating point accumulation and when the loop exits
    // But they should be very close (within 1 tick)
    expect(Math.abs(ticksVar - ticks60)).toBeLessThanOrEqual(1);

    // If tick counts match exactly, scores must be identical
    // If they differ by 1, scores should be close (differ by one RNG draw)
    if (ticksVar === ticks60) {
      expect(scoreVar).toBe(score60);
    } else {
      // Allow for one extra RNG draw (1-10 range)
      expect(Math.abs(scoreVar - score60)).toBeLessThanOrEqual(10);
    }
  });
});

describe('Known Limitations & Issues', () => {
  it('DOCUMENT: Phaser Physics may not be fully deterministic', () => {
    // This is a known limitation that needs verification
    // Phaser.Physics.Arcade may have floating-point precision differences
    // across different machines/browsers

    // TODO: Test Phaser physics determinism
    // - Collision detection
    // - Body velocity updates
    // - Overlap checks

    expect(true).toBe(true); // Placeholder
  });

  it('DOCUMENT: Phaser Tweens timing', () => {
    // Tweens use wall-clock time, not fixed timestep
    // But they're mostly cosmetic (visual effects, UI animations)
    // Gameplay-critical logic shouldn't depend on tween completion

    expect(true).toBe(true); // Placeholder
  });

  it('DOCUMENT: Floating-point precision', () => {
    // JavaScript floating-point math follows IEEE 754
    // Should be deterministic within same runtime
    // Cross-platform determinism may require fixed-point math

    expect(true).toBe(true); // Placeholder
  });
});
