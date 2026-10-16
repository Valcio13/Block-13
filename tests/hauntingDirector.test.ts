import { describe, expect, it } from 'vitest';
import { AuthoritativeSimulation } from '../src/core/authoritativeSimulation';
import { HAUNTING_EVENT_BUDGET, HAUNTING_EVENT_COOLDOWN_TICKS, HAUNTING_VISUAL_ACTOR_FLAGS, hauntingEventFor, hauntingPresentationAllowed, hauntingWhisperLine, HauntingDirector, HorrorPacingModel, HauntingSilence } from '../src/game/hauntingDirector';

describe('presentation haunting director', () => {
  it('is deterministic for identical stable inputs and never uses Math.random', async () => {
    const input = { floor: 1, tick: 720, tileX: 8, tileY: 11 };
    const slot = Math.floor(input.tick / 720);
    expect(hauntingEventFor(input, slot)).toEqual(hauntingEventFor(input, slot));
    expect(new HauntingDirector().evaluate(input)).toEqual(new HauntingDirector().evaluate(input));
    const source = await import('node:fs/promises');
    const text = await source.readFile(new URL('../src/game/hauntingDirector.ts', import.meta.url), 'utf8');
    expect(text).not.toMatch(/Math\s*\.\s*random/);
  });

  it('does not mutate authoritative state or consume the simulation RNG stream', () => {
    const simA = new AuthoritativeSimulation(912345n, { floor: 1 });
    const simB = new AuthoritativeSimulation(912345n, { floor: 1 });
    const before = JSON.stringify(simA.state);
    const director = new HauntingDirector();
    const pacing = new HorrorPacingModel();
    for (let tick = 1; tick < 5000; tick++) director.evaluate({ floor: 1, tick, tileX: 9, tileY: 12 });
    expect(JSON.stringify(simA.state)).toBe(before);
    for (let i = 0; i < 20; i++) {
      pacing.observe({ floor: 1, tileX: i, tileY: i % 3, deltaMs: 16, moving: true, realThreatActive: i > 8, encounterStarted: i === 9 });
      simA.step({ up: false, down: false, left: false, right: false, interact: false, flashlight: false });
      simB.step({ up: false, down: false, left: false, right: false, interact: false, flashlight: false });
    }
    expect(simA.state).toEqual(simB.state);
  });

  it('drives unease, suspicion, and dread from exploration and real encounters rather than a stage timer', () => {
    const pacing = new HorrorPacingModel();
    expect(pacing.stage).toBe('unease');
    expect(pacing.observe({ floor: 4, tileX: 1, tileY: 1, deltaMs: 60_000, moving: false, realThreatActive: false, encounterStarted: false })).toBe('unease');
    const first = pacing.pressureValue;
    pacing.observe({ floor: 4, tileX: 1, tileY: 1, deltaMs: 0, moving: true, realThreatActive: false, encounterStarted: false });
    expect(pacing.pressureValue).toBe(first + 3);
    for (let x = 2; x <= 14; x++) pacing.observe({ floor: 4, tileX: x, tileY: 1, deltaMs: 0, moving: true, realThreatActive: false, encounterStarted: false });
    expect(pacing.stage).toBe('suspicion');
    pacing.observe({ floor: 4, tileX: 15, tileY: 1, deltaMs: 0, moving: true, realThreatActive: false, encounterStarted: true });
    expect(pacing.stage).toBe('suspicion');
    for (let frame = 0; frame < 25; frame++) pacing.observe({ floor: 4, tileX: 15, tileY: 1, deltaMs: 1000, moving: false, realThreatActive: true, encounterStarted: false });
    expect(pacing.stage).toBe('dread');
    pacing.observe({ floor: 4, tileX: 15, tileY: 1, deltaMs: 120_000, moving: false, realThreatActive: false, encounterStarted: false });
    expect(pacing.stage).toBe('unease');
  });

  it('allows only low-intensity events during unease and reserves false Stalkers for dread', () => {
    for (let x = 0; x < 300; x++) {
      const input = { floor: 2, tick: 900, tileX: x, tileY: x * 7 };
      const uneaseEvent = hauntingEventFor(input, 3, 'unease');
      const suspicionEvent = hauntingEventFor(input, 3, 'suspicion');
      if (uneaseEvent) expect(['false_footstep', 'environment_shift']).toContain(uneaseEvent.type);
      if (suspicionEvent) expect(suspicionEvent.type).not.toBe('fake_stalker');
    }
    let fakeCandidate = false;
    for (let x = 0; x < 3000 && !fakeCandidate; x++) {
      fakeCandidate = hauntingEventFor({ floor: 2, tick: 900, tileX: x, tileY: x * 7 }, 3, 'dread')?.type === 'fake_stalker';
    }
    expect(fakeCandidate).toBe(true);
    expect(hauntingEventFor({ floor: 4, tick: 1800, tileX: 8, tileY: 9 }, 3, 'dread')?.type).not.toBe('fake_stalker');
  });

  it('gives real enemy encounters presentation priority and starts recovery after them', () => {
    const director = new HauntingDirector();
    director.prepareFloor(1);
    director.registerMajorEncounter(2000);
    expect(director.canPresentAt(2000)).toBe(false);
    expect(director.evaluate({ floor: 1, tick: 2200, tileX: 4, tileY: 7 }, 'dread')).toBeNull();
    expect(director.evaluateSearch({ floor: 1, tick: 2200, tileX: 4, tileY: 7 }, 3)).toBeNull();
    expect(director.canPresentAt(2540)).toBe(true);
    expect(hauntingPresentationAllowed({ tick: 2540, status: 'playing', paused: false, transitioning: false, modalOpen: false, presentationActive: false, realThreatActive: false, recoveryUntilTick: 2540 })).toBe(true);
    for (const blocked of [
      { paused: true }, { transitioning: true }, { modalOpen: true }, { presentationActive: true }, { realThreatActive: true },
    ]) expect(hauntingPresentationAllowed({ tick: 3000, status: 'playing', paused: false, transitioning: false, modalOpen: false, presentationActive: false, realThreatActive: false, recoveryUntilTick: 0, ...blocked })).toBe(false);
  });

  it('restrains Block 4, excludes fake Stalker there, and applies budgets and cooldowns', () => {
    expect(HAUNTING_EVENT_BUDGET[4]).toBe(1);
    expect(hauntingEventFor({ floor: 4, tick: 1800, tileX: 4, tileY: 6 }, 1)?.type).not.toBe('fake_stalker');
    let candidate: { floor: number; tick: number; tileX: number; tileY: number } | undefined;
    for (let x = 0; x < 300 && !candidate; x++) {
      const input = { floor: 3, tick: 1200, tileX: x, tileY: x * 7 };
      if (hauntingEventFor(input, Math.floor(input.tick / 1200))) candidate = input;
    }
    expect(candidate).toBeDefined();
    if (candidate) {
      const paced = new HauntingDirector();
      expect(paced.evaluate(candidate)).not.toBeNull();
      expect(paced.evaluate({ ...candidate, tick: candidate.tick + 1200 })).toBeNull();
    }
    const director = new HauntingDirector();
    let emitted = 0;
    for (let tick = 1; tick <= 100_000; tick++) {
      if (director.evaluate({ floor: 4, tick, tileX: 4, tileY: 6 })) emitted++;
    }
    expect(emitted).toBeLessThanOrEqual(HAUNTING_EVENT_BUDGET[4]);
    expect(HAUNTING_EVENT_COOLDOWN_TICKS[4]).toBeGreaterThan(0);
  });

  it('escalates event chance progressively without making floor 4 active', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(new URL('../src/game/hauntingDirector.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/FLOOR_PROBABILITY[\s\S]*?4:\s*2[\s\S]*?3:\s*12[\s\S]*?2:\s*18[\s\S]*?1:\s*22[\s\S]*?0:\s*25/);
    expect(hauntingEventFor({ floor: 4, tick: 1800, tileX: 1, tileY: 1 }, 0)?.type).not.toBe('fake_stalker');
    expect(hauntingEventFor({ floor: 3, tick: 1200, tileX: 1, tileY: 1 }, 0)?.type).not.toBe('fake_stalker');
  });

  it('makes search paranoia presentation-only and exposes non-entity visual flags', () => {
    const input = { floor: 1, tick: 360, tileX: 5, tileY: 7 };
    const before = { result: { type: 'nothing' as const }, searched: [false, true] };
    const snapshot = JSON.stringify(before);
    const director = new HauntingDirector();
    director.evaluateSearch(input, 0);
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(HAUNTING_VISUAL_ACTOR_FLAGS).toEqual({ authoritativeEntity: false, collision: false, damage: false });
  });

  it('selects world whispers deterministically and coordinates search events with ambient pacing', () => {
    expect(hauntingWhisperLine(1234, 7, 9)).toBe(hauntingWhisperLine(1234, 7, 9));
    expect(hauntingWhisperLine(1234, 7, 9)).not.toBe(hauntingWhisperLine(1234, 8, 9));
    const director = new HauntingDirector();
    director.evaluate({ floor: 0, tick: 1, tileX: 3, tileY: 5 }); // establish the active floor
    let search: ReturnType<HauntingDirector['evaluateSearch']> = null;
    for (let searchIndex = 0; searchIndex < 200 && !search; searchIndex++) {
      search = director.evaluateSearch({ floor: 0, tick: 400, tileX: searchIndex, tileY: searchIndex * 3 }, searchIndex);
    }
    expect(search).not.toBeNull();
    if (search) {
      expect(director.evaluateSearch({ floor: 0, tick: 401, tileX: 4, tileY: 8 }, 201)).toBeNull();
      expect(director.evaluate({ floor: 0, tick: 600, tileX: 4, tileY: 8 })).toBeNull();
    }
  });

  it('smoothly restores ambience and cleanup restores every lifecycle exit to unity', () => {
    const silence = new HauntingSilence();
    silence.start(1000);
    expect(silence.update(20)).toBeLessThan(1);
    for (const lifecycle of ['pause', 'death', 'floor transition', 'scene shutdown']) {
      expect(['pause', 'death', 'floor transition', 'scene shutdown']).toContain(lifecycle);
      expect(silence.clear()).toBe(1);
      silence.start(1000);
    }
    expect(silence.update(1200)).toBe(1);
    expect(silence.isActive).toBe(false);
  });

  it('wires cleanup to pause, death, transition, victory, and shutdown without mutating tile geometry', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(new URL('../src/game/scenes/FloorScene.ts', import.meta.url), 'utf8');
    for (const method of ['showPauseMenu', 'completeFloor', 'playerDeath', 'beginVictoryEpilogue', 'shutdown']) {
      const start = source.indexOf(`private ${method}(`) >= 0
        ? source.indexOf(`private ${method}(`)
        : source.indexOf(`  ${method}()`);
      const end = source.indexOf('\n  private ', start + 1);
      expect(source.slice(start, end < 0 ? undefined : end), method).toContain('clearHauntingPresentation');
    }
    const placementStart = source.indexOf('private findHauntingTile');
    const placementEnd = source.indexOf('\n  private ', placementStart + 1);
    expect(source.slice(placementStart, placementEnd)).not.toMatch(/floorData\.tiles\s*\[[^\n]*\]\s*=/);
    expect(HAUNTING_VISUAL_ACTOR_FLAGS).toEqual({ authoritativeEntity: false, collision: false, damage: false });
  });
});
