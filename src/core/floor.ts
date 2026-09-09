import { SeededRng } from './rng';

export type Floor = { 
  width: number; 
  height: number; 
  tiles: boolean[][]; 
  start: [number, number]; 
  key: [number, number]; 
  exit: [number, number];
  rooms: Room[];
  doors: [number, number][];
};

export type Room = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function generateFloor(seed: number, floor: number): Floor {
  const rng = new SeededRng(seed ^ ((floor + 1) * 0x9e3779b9));
  const width = 41;
  const height = 31;
  
  // Initialize all tiles as walls
  const tiles = Array.from({ length: height }, () => 
    Array.from({ length: width }, () => false)
  );

  // Generate rooms
  const rooms: Room[] = [];
  const numRooms = 6 + floor * 2; // More rooms on deeper floors (8, 10, 12...)
  const attempts = numRooms * 10;

  for (let i = 0; i < attempts && rooms.length < numRooms; i++) {
    const roomWidth = 5 + rng.int(6); // 5-10
    const roomHeight = 4 + rng.int(5); // 4-8
    const x = 2 + rng.int(width - roomWidth - 4);
    const y = 2 + rng.int(height - roomHeight - 4);

    const newRoom: Room = { x, y, width: roomWidth, height: roomHeight };

    // Check if room overlaps with existing rooms (with 2-tile buffer)
    const overlaps = rooms.some(room => 
      !(newRoom.x + newRoom.width + 1 < room.x ||
        newRoom.x > room.x + room.width + 1 ||
        newRoom.y + newRoom.height + 1 < room.y ||
        newRoom.y > room.y + room.height + 1)
    );

    if (!overlaps) {
      rooms.push(newRoom);
      carveRoom(tiles, newRoom);
    }
  }

  // Connect rooms with corridors
  const doors: [number, number][] = [];
  for (let i = 1; i < rooms.length; i++) {
    const roomA = rooms[i - 1];
    const roomB = rooms[i];
    const newDoors = connectRooms(tiles, roomA, roomB, rng);
    doors.push(...newDoors);
  }

  // Ensure first and last rooms are connected with an extra corridor
  if (rooms.length > 2) {
    const extraDoors = connectRooms(tiles, rooms[0], rooms[rooms.length - 1], rng);
    doors.push(...extraDoors);
  }

  // Place key, exit, and start in separate rooms
  const start = getCenterOfRoom(rooms[0]);
  const key = getCenterOfRoom(rooms[Math.floor(rooms.length / 2)]);
  const exit = getCenterOfRoom(rooms[rooms.length - 1]);

  // Ensure important positions are walkable
  for (const [x, y] of [start, key, exit]) {
    tiles[y][x] = true;
  }

  return { width, height, tiles, start, key, exit, rooms, doors };
}

function carveRoom(tiles: boolean[][], room: Room) {
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) {
        tiles[y][x] = true;
      }
    }
  }
}

function connectRooms(
  tiles: boolean[][], 
  roomA: Room, 
  roomB: Room, 
  rng: SeededRng
): [number, number][] {
  const doors: [number, number][] = [];
  
  // Get random points in each room
  const pointA: [number, number] = [
    roomA.x + 1 + rng.int(roomA.width - 2),
    roomA.y + 1 + rng.int(roomA.height - 2)
  ];
  const pointB: [number, number] = [
    roomB.x + 1 + rng.int(roomB.width - 2),
    roomB.y + 1 + rng.int(roomB.height - 2)
  ];

  let [x, y] = pointA;
  const [targetX, targetY] = pointB;

  // L-shaped corridor
  if (rng.int(2) === 0) {
    // Horizontal then vertical
    const doorAdded = carveHorizontalCorridor(tiles, x, targetX, y, doors);
    if (doorAdded) doors.push(doorAdded);
    x = targetX;
    const doorAdded2 = carveVerticalCorridor(tiles, y, targetY, x, doors);
    if (doorAdded2) doors.push(doorAdded2);
  } else {
    // Vertical then horizontal
    const doorAdded = carveVerticalCorridor(tiles, y, targetY, x, doors);
    if (doorAdded) doors.push(doorAdded);
    y = targetY;
    const doorAdded2 = carveHorizontalCorridor(tiles, x, targetX, y, doors);
    if (doorAdded2) doors.push(doorAdded2);
  }

  return doors;
}

function carveHorizontalCorridor(
  tiles: boolean[][], 
  x1: number, 
  x2: number, 
  y: number,
  doors: [number, number][]
): [number, number] | null {
  const start = Math.min(x1, x2);
  const end = Math.max(x1, x2);
  let doorPos: [number, number] | null = null;

  for (let x = start; x <= end; x++) {
    if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) {
      // Check if this is a door position (transition from wall to floor or vice versa)
      const wasWall = !tiles[y][x];
      tiles[y][x] = true;
      
      // Make corridor 2 tiles wide for better visibility
      if (y + 1 < tiles.length) {
        tiles[y + 1][x] = true;
      }
      
      if (wasWall && !doorPos) {
        doorPos = [x, y];
      }
    }
  }
  
  return doorPos;
}

function carveVerticalCorridor(
  tiles: boolean[][], 
  y1: number, 
  y2: number, 
  x: number,
  doors: [number, number][]
): [number, number] | null {
  const start = Math.min(y1, y2);
  const end = Math.max(y1, y2);
  let doorPos: [number, number] | null = null;

  for (let y = start; y <= end; y++) {
    if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) {
      // Check if this is a door position
      const wasWall = !tiles[y][x];
      tiles[y][x] = true;
      
      // Make corridor 2 tiles wide
      if (x + 1 < tiles[0].length) {
        tiles[y][x + 1] = true;
      }
      
      if (wasWall && !doorPos) {
        doorPos = [x, y];
      }
    }
  }
  
  return doorPos;
}

function getCenterOfRoom(room: Room): [number, number] {
  return [
    Math.floor(room.x + room.width / 2),
    Math.floor(room.y + room.height / 2)
  ];
}
