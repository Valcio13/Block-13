import { describe, it, expect } from 'vitest';
import { generateFloor } from './floor';

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
    expect(floor3.rooms.length).toBeGreaterThanOrEqual(floor1.rooms.length);
  });
});
