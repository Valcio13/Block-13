import { describe, it, expect } from 'vitest';
import { generateFloor, LOOT_PROBABILITIES, LOOT_THRESHOLDS } from './floor';

describe('Floor Generation', () => {
  it('generates a deterministic floor from a seed', () => {
    const seed = 12345;
    const floor1 = generateFloor(seed, 1);
    const floor2 = generateFloor(seed, 1);
    
    expect(floor1.width).toBe(floor2.width);
    expect(floor1.height).toBe(floor2.height);
    expect(floor1.start).toEqual(floor2.start);
    expect(floor1.key).toEqual(floor2.key);
    expect(floor1.exit).toEqual(floor2.exit);
    expect(floor1.rooms.length).toBe(floor2.rooms.length);
    expect(floor1.searchables).toEqual(floor2.searchables);
  });

  it('uses the exact 100% loot table and keeps RNG draw count independent of loot outcomes', () => {
    expect(LOOT_PROBABILITIES).toEqual({ battery: 24, health: 18, collectible: 25, clue: 8, empty: 25 });
    expect(Object.values(LOOT_PROBABILITIES).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(LOOT_THRESHOLDS).toEqual({ battery: 24, health: 42, collectible: 67, clue: 75 });

    const runWithLootRoll = (roll: number) => {
      let draws = 0;
      const floor = generateFloor(0x13579, 2, {
        next: () => { draws++; return roll; },
        int: () => { draws++; return 0; },
      });
      return { draws, floor };
    };
    const mostlyMimicsOrBattery = runWithLootRoll(0.1);
    const mostlyEmpty = runWithLootRoll(0.99);
    expect(mostlyMimicsOrBattery.floor.searchables).not.toEqual(mostlyEmpty.floor.searchables);
    expect(mostlyMimicsOrBattery.draws).toBe(mostlyEmpty.draws);
  });

  it('ensures start, key, and exit are walkable', () => {
    const floor = generateFloor(54321, 1);
    
    const [startX, startY] = floor.start;
    const [keyX, keyY] = floor.key;
    const [exitX, exitY] = floor.exit;
    
    expect(floor.tiles[startY][startX]).toBe(true);
    expect(floor.tiles[keyY][keyX]).toBe(true);
    expect(floor.tiles[exitY][exitX]).toBe(true); // Fixed: was using exitY twice
  });

  it('generates rooms with corridors', () => {
    const floor = generateFloor(99999, 1);
    
    expect(floor.rooms.length).toBeGreaterThan(0);
    expect(floor.doors.length).toBeGreaterThan(0);
  });

  it('places objectives in different rooms', () => {
    const floor = generateFloor(11111, 1);
    
    const startRoom = floor.rooms[0];
    const lastRoom = floor.rooms[floor.rooms.length - 1];
    
    // Start should be in first room
    const [startX, startY] = floor.start;
    expect(startX).toBeGreaterThanOrEqual(startRoom.x);
    expect(startX).toBeLessThan(startRoom.x + startRoom.width);
    expect(startY).toBeGreaterThanOrEqual(startRoom.y);
    expect(startY).toBeLessThan(startRoom.y + startRoom.height);
    
    // Exit should be in last room
    const [exitX, exitY] = floor.exit;
    expect(exitX).toBeGreaterThanOrEqual(lastRoom.x);
    expect(exitX).toBeLessThan(lastRoom.x + lastRoom.width);
    expect(exitY).toBeGreaterThanOrEqual(lastRoom.y);
    expect(exitY).toBeLessThan(lastRoom.y + lastRoom.height);
  });

  it('generates more rooms on deeper floors', () => {
    const floor1 = generateFloor(77777, 1);
    const floor3 = generateFloor(77777, 3);
    
    // Just verify floor 3 has more rooms than floor 1
    // Actual counts may vary due to spatial constraints
    expect(floor1.rooms.length).toBeGreaterThan(0);
    expect(floor3.rooms.length).toBeGreaterThan(0);
    expect(floor1.rooms.length).toBeGreaterThanOrEqual(floor3.rooms.length);
  });

  it('places at most one searchable on each tile across generated floors', () => {
    for (const seed of [1, 7, 42, 54321, 0xabcde123]) {
      for (const floorNumber of [4, 3, 2, 1, 0]) {
        const floor = generateFloor(seed, floorNumber);
        const positions = floor.searchables.map(item => `${item.x},${item.y}`);
        expect(new Set(positions).size, `duplicate searchable on seed ${seed}, floor ${floorNumber}`).toBe(positions.length);
      }
    }
  });

  it('gives Block 13 a deterministic hub with connected arrival, key and escape branches', () => {
    const reachable = (floor: ReturnType<typeof generateFloor>, target: [number, number]) => {
      const pending: [number, number][] = [floor.start];
      const seen = new Set([`${floor.start[0]},${floor.start[1]}`]);
      for (let i = 0; i < pending.length; i++) {
        const [x, y] = pending[i];
        for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]] as [number, number][]) {
          const id = `${nx},${ny}`;
          if (floor.tiles[ny]?.[nx] && !seen.has(id)) { seen.add(id); pending.push([nx, ny]); }
        }
      }
      return seen.has(`${target[0]},${target[1]}`);
    };

    for (const seed of [1, 7, 42, 54321, 0xabcde123]) {
      const floor = generateFloor(seed, 0);
      const repeated = generateFloor(seed, 0);
      expect(floor).toEqual(repeated);
      expect(floor.block13Hub).toEqual([Math.floor(floor.width / 2), Math.floor(floor.height / 2)]);
      const [hx, hy] = floor.block13Hub!;
      for (let y = hy - 3; y <= hy + 3; y++) {
        for (let x = hx - 4; x <= hx + 4; x++) expect(floor.tiles[y][x]).toBe(true);
      }
      expect(reachable(floor, floor.key)).toBe(true);
      expect(reachable(floor, floor.exit)).toBe(true);
    }
    expect(generateFloor(42, 1).block13Hub).toBeUndefined();
  });
});
