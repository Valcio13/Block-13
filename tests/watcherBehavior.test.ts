import { describe, expect, it } from 'vitest';
import { AuthoritativeSimulation, authoritativeLineOfSight, FIXED_SCALE } from '../src/core/authoritativeSimulation';
import { watcherIndividuallyCausingCurse, watcherIsCausingCurse } from '../src/game/contestUx';

const neutral = { left: false, right: false, up: false, down: false, flashlight: false, interact: false };

function simWithWatcher(facingX: number) {
  const probe = new AuthoritativeSimulation(0x7713n, { floor: 0, crawlers: [], watchers: [], ambushers: [], mimics: [] });
  const x = probe.state.x, y = probe.state.y;
  return new AuthoritativeSimulation(0x7713n, {
    floor: 0, x, y, facingX, facingY: 0,
    stalker: { ...probe.state.stalker, ticksRemaining: 100_000 },
    crawlers: [],
    watchers: [{ id: 0, x: x + 80 * FIXED_SCALE, y, active: true, illuminatedTicks: 0, decayRemainder: 0, curseRemainder: 0 }],
    ambushers: [], mimics: [],
  });
}

describe('Watcher threat behavior', () => {
  it('uses deterministic tile LOS for open, blocked, and edge rays', () => {
    const tiles = Array.from({ length: 5 }, () => Array(5).fill(true));
    const center = (tile: number) => tile * 32 * FIXED_SCALE + 16 * FIXED_SCALE;
    expect(authoritativeLineOfSight(tiles, center(1), center(2), center(3), center(2))).toBe(true);
    tiles[2][2] = false;
    expect(authoritativeLineOfSight(tiles, center(1), center(2), center(3), center(2))).toBe(false);
    expect(authoritativeLineOfSight(tiles, center(1), center(1), center(1), center(1))).toBe(true);
    tiles[2][2] = true;
    expect(authoritativeLineOfSight(tiles, center(1), center(2), center(2), center(2))).toBe(true);
  });

  it('applies curse only while the active Watcher is in the authoritative gaze cone', () => {
    const lookingAt = simWithWatcher(1);
    const lookingAway = simWithWatcher(-1);
    expect(watcherIsCausingCurse(lookingAt.state)).toBe(true);
    expect(watcherIsCausingCurse(lookingAway.state)).toBe(false);
    expect(watcherIndividuallyCausingCurse(lookingAt.state, lookingAt.state.watchers[0])).toBe(true);
    expect(watcherIndividuallyCausingCurse(lookingAway.state, lookingAway.state.watchers[0])).toBe(false);
    expect(watcherIndividuallyCausingCurse({ ...lookingAt.state, lineOfSight: () => false }, lookingAt.state.watchers[0])).toBe(false);
    for (let tick = 0; tick < 60; tick++) {
      lookingAt.step(neutral);
      lookingAway.step(neutral);
    }
    expect(lookingAt.state.curse).toBeGreaterThan(0);
    expect(lookingAway.state.curse).toBe(0);
  });

  it('lets a sustained flashlight beam banish it without changing player resources', () => {
    const sim = simWithWatcher(1);
    const hp = sim.state.hp, battery = sim.state.battery, score = sim.state.score;
    for (let tick = 0; tick < 241; tick++) sim.step({ ...neutral, flashlight: tick === 0 });
    expect(sim.state.watchers[0].active).toBe(false);
    expect(sim.state.hp).toBe(hp);
    expect(sim.state.score).toBe(score);
    expect(sim.state.battery).toBeLessThan(battery); // existing flashlight cost only
  });
});
