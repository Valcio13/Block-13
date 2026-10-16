import { describe, expect, it } from 'vitest';
import { AuthoritativeSimulation, ENCOUNTER_ROSTER_BOUNDS } from '../src/core/authoritativeSimulation';
import { PCG32 } from '../src/core/pcg32';

describe('versioned rare-enemy roster', () => {
  it('keeps generated populations within the authored floor bounds across 128 seeds', () => {
    const total: Record<number, { crawler: number; watcher: number; ambusher: number }> = {};
    const priorTotal: Record<number, { crawler: number; watcher: number; ambusher: number }> = {};
    for (const floor of [4, 3, 2, 1, 0]) total[floor] = { crawler: 0, watcher: 0, ambusher: 0 };
    for (const floor of [4, 3, 2, 1, 0]) priorTotal[floor] = { crawler: 0, watcher: 0, ambusher: 0 };
    const samples = 128;
    for (let seed = 1; seed <= samples; seed++) for (const floor of [4, 3, 2, 1, 0]) {
      const state = new AuthoritativeSimulation(BigInt(seed), { floor }).state;
      const counts = { crawlers: state.crawlers.length, watchers: state.watchers.length, ambushers: state.ambushers.length };
      const bounds = ENCOUNTER_ROSTER_BOUNDS[floor as keyof typeof ENCOUNTER_ROSTER_BOUNDS];
      for (const enemy of ['crawlers', 'watchers', 'ambushers'] as const) {
        expect(counts[enemy]).toBeGreaterThanOrEqual(bounds[enemy][0]);
        expect(counts[enemy]).toBeLessThanOrEqual(bounds[enemy][1]);
      }
      total[floor].crawler += counts.crawlers;
      total[floor].watcher += counts.watchers;
      total[floor].ambusher += counts.ambushers;

      const crawlerRng = new PCG32(BigInt(seed) ^ 0x435241574c4552n);
      const watcherRng = new PCG32(BigInt(seed) ^ 0x57415443484552n);
      const ambusherRng = new PCG32(BigInt(seed) ^ 0x414d425553484552n);
      const prior = { crawler: 0, watcher: 0, ambusher: 0 };
      switch (floor) {
        case 4: prior.ambusher = ambusherRng.nextInt() % 2; break;
        case 3: prior.crawler = crawlerRng.nextInt() % 2; prior.watcher = watcherRng.nextInt() % 2; prior.ambusher = 1; break;
        case 2: prior.crawler = 1 + crawlerRng.nextRange(0, 1); prior.watcher = 1; prior.ambusher = 1 + ambusherRng.nextRange(0, 1); break;
        case 1: prior.crawler = 2 + crawlerRng.nextRange(0, 1); prior.watcher = 1 + watcherRng.nextRange(0, 1); prior.ambusher = 2; break;
        case 0: prior.crawler = 3 + crawlerRng.nextRange(0, 1); prior.watcher = 2 + watcherRng.nextRange(0, 1); prior.ambusher = 2 + ambusherRng.nextRange(0, 1); break;
      }
      priorTotal[floor].crawler += prior.crawler;
      priorTotal[floor].watcher += prior.watcher;
      priorTotal[floor].ambusher += prior.ambusher;
    }
    const averages = Object.fromEntries(Object.entries(total).map(([floor, counts]) => [
      floor, Object.fromEntries(Object.entries(counts).map(([name, amount]) => [name, Number((amount / samples).toFixed(2))])),
    ]));
    const priorAverages = Object.fromEntries(Object.entries(priorTotal).map(([floor, counts]) => [
      floor, Object.fromEntries(Object.entries(counts).map(([name, amount]) => [name, Number((amount / samples).toFixed(2))])),
    ]));
    console.info('Mean spawned enemy counts / 128 seeds; prior rules → Floor 13 0.5.0:', { prior: priorAverages, current: averages });
    const expected = {
      0: { crawler: 2, watcher: 1.5, ambusher: 1 },
      1: { crawler: 1.5, watcher: 1, ambusher: 1 },
      2: { crawler: 1, watcher: 0.5, ambusher: 0.5 },
      3: { crawler: 0.5, watcher: 0, ambusher: 0.5 },
      4: { crawler: 0, watcher: 0, ambusher: 0 },
    };
    for (const [floor, values] of Object.entries(expected)) for (const [enemy, mean] of Object.entries(values)) {
      expect(Math.abs(averages[Number(floor)][enemy] - mean)).toBeLessThanOrEqual(0.13);
    }
  });

  it('keeps Floor 4 free of immediate pursuit before the photograph is found', () => {
    const sim = new AuthoritativeSimulation(0x4013n, { floor: 4 });
    for (let tick = 0; tick < 900; tick++) sim.step({ left: false, right: false, up: false, down: false, flashlight: false, interact: false });
    expect(sim.state.stalker.state).toBe('dormant');
    expect(sim.state.stalker.visible).toBe(false);
    expect(sim.state.crawlers).toHaveLength(0);
    expect(sim.state.watchers).toHaveLength(0);
    expect(sim.state.ambushers).toHaveLength(0);
  });
});
