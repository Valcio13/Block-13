import { describe, expect, it } from 'vitest';
import { AuthoritativeSimulation } from '../src/core/authoritativeSimulation';

function shortestPathTiles(tiles: boolean[][], from: [number, number], to: [number, number]): number {
  const width = tiles[0]?.length ?? 0;
  const queue: Array<[number, number]> = [from];
  const distance = new Map<string, number>([[`${from[0]},${from[1]}`, 0]]);
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head];
    const current = distance.get(`${x},${y}`)!;
    if (x === to[0] && y === to[1]) return current;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
      if (!tiles[ny]?.[nx] || distance.has(key)) continue;
      distance.set(key, current + 1);
      queue.push([nx, ny]);
    }
  }
  throw new Error(`unreachable generated route from ${from} to ${to}`);
}

describe('deterministic battery pressure measurements', () => {
  it('measures an all-light exploration upper bound without changing gameplay', () => {
    const estimates: number[] = [];
    for (let seed = 1; seed <= 128; seed++) for (const floor of [4, 3, 2, 1, 0]) {
      const sim = new AuthoritativeSimulation(BigInt(seed), { floor });
      const map = sim.floor;
      let cursor = [...map.start] as [number, number];
      let tiles = 0;
      for (const index of map.objectives.searchableIndices) {
        const evidence = map.searchables[index];
        tiles += shortestPathTiles(map.tiles, cursor, [evidence.x, evidence.y]);
        cursor = [evidence.x, evidence.y];
      }
      tiles += shortestPathTiles(map.tiles, cursor, map.puzzleDevice);
      tiles += shortestPathTiles(map.tiles, map.puzzleDevice, map.exit);
      // At 160 px/s and 32 px tiles, this is the maximum continuous-light
      // estimate. It intentionally ignores combat pauses and detours.
      estimates.push((tiles * 0.2) * (240 / 256));
    }
    const sorted = [...estimates].sort((a, b) => a - b);
    const percentile = (p: number) => sorted[Math.floor((sorted.length - 1) * p)];
    console.info('All-light battery pressure estimate (%):', {
      median: Number(percentile(0.5).toFixed(1)),
      p95: Number(percentile(0.95).toFixed(1)),
      max: Number(percentile(1).toFixed(1)),
      samples: estimates.length,
    });
    expect(estimates).toHaveLength(640);
    expect(estimates.every(value => Number.isFinite(value) && value >= 0)).toBe(true);
  }, 15_000);
});
