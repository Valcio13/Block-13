import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRun } from '../src/core/run';
import { localPlaytestRun } from '../src/game/localPlaytest';

describe('development Local playtest run overrides', () => {
  it('starts a repeatable run at any authored floor with the requested seed', () => {
    for (const [name, floor, completed] of [
      ['block4', 4, 0], ['block3', 3, 1], ['block2', 2, 2], ['block1', 1, 3], ['block13', 0, 4],
    ] as const) {
      const run = localPlaytestRun(createRun(), `?playtestFloor=${name}&playtestSeed=123456789`);
      expect(run).toMatchObject({
        floor,
        floorsCompleted: completed,
        seed: 123456789,
        canonicalSeed: '123456789',
        status: 'playing',
      });
      expect(localPlaytestRun(createRun(), `?playtestFloor=${name}&playtestSeed=123456789`).canonicalSeed)
        .toBe(run.canonicalSeed);
    }
  });

  it('uses a stable default seed when only the floor is specified', () => {
    expect(localPlaytestRun(createRun(), '?playtestFloor=13').canonicalSeed).toBe('13');
  });

  it('ignores overrides on manifest-backed runs or when invalid', () => {
    const local = createRun();
    const onchain = { ...local, manifest: {} as NonNullable<typeof local.manifest> };
    expect(localPlaytestRun(onchain, '?playtestFloor=block13&playtestSeed=3')).toBe(onchain);
    expect(localPlaytestRun(local, '?playtestFloor=unknown&playtestSeed=3')).toBe(local);
    expect(localPlaytestRun(local, '?playtestFloor=block13&playtestSeed=not-a-seed')).toBe(local);
    expect(localPlaytestRun(local, `?playtestFloor=block13&playtestSeed=${1n << 64n}`)).toBe(local);
  });

  it('calls the override only behind Vite’s development constant', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    expect(app).toContain('import.meta.env.DEV');
    expect(app).toContain('? localPlaytestRun(createdLocalRun, window.location.search)');
  });
});
