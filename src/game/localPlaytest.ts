import type { RunState } from '../core/run';
import { START_FLOOR } from '../core/progression';

const FLOOR_NAMES: Readonly<Record<string, number>> = {
  '4': 4,
  '3': 3,
  '2': 2,
  '1': 1,
  '13': 0,
  block4: 4,
  block3: 3,
  block2: 2,
  block1: 1,
  block13: 0,
};

const MAX_CANONICAL_SEED = (1n << 64n) - 1n;

/** Development-only Local run override for repeatable floor-start playtests. */
export function localPlaytestRun(
  run: RunState,
  search: string,
): RunState {
  if (run.manifest) return run;
  const params = new URLSearchParams(search);
  const requestedFloor = params.get('playtestFloor');
  const requestedSeed = params.get('playtestSeed');
  if (requestedFloor === null && requestedSeed === null) return run;

  const floor = requestedFloor === null ? run.floor : FLOOR_NAMES[requestedFloor.toLowerCase()];
  if (floor === undefined) return run;

  let seed: bigint;
  try {
    const rawSeed = requestedSeed ?? '13';
    if (!/^\d+$/.test(rawSeed)) return run;
    seed = BigInt(rawSeed);
  } catch {
    return run;
  }
  if (seed < 0n || seed > MAX_CANONICAL_SEED) return run;

  return {
    ...run,
    floor,
    floorsCompleted: START_FLOOR - floor,
    canonicalSeed: seed.toString(10),
    seed: Number(seed & 0xffff_ffffn),
  };
}
