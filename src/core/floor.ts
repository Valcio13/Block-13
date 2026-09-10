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
  searchables: Searchable[];
};

export type Room = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SearchableType = 'cabinet' | 'locker' | 'box' | 'drawer' | 'mimic';

export type SearchResult = 
  | { type: 'battery'; amount: number }
  | { type: 'health'; amount: number }
  | { type: 'collectible'; item: 'eth' | 'btc' | 'hemi'; score: number }
  | { type: 'clue'; id: string }
  | { type: 'nothing' }
  | { type: 'mimic_reveal' }; // Special result for mimics

export type Searchable = {
  x: number;
  y: number;
  objectType: SearchableType;
  result: SearchResult;
  isMimic: boolean; // Track if this is a mimic
};

export function generateFloor(seed: number, floor: number): Floor {
  const rng = new SeededRng(seed ^ ((floor + 1) * 0x9e3779b9));
  
  // Floor 4 is slightly smaller/easier; others scale up
  let width: number, height: number, numRooms: number;
  
  if (floor === 4) {
    width = 45;
    height = 37;
    numRooms = 10 + rng.int(3); // 10-12 rooms
  } else {
    width = 51;
    height = 41;
    numRooms = 12 + (4 - floor) * 3; // Floor 3: 15, Floor 2: 18, Floor 1: 21
  }
  
  // Initialize all tiles as walls
  const tiles = Array.from({ length: height }, () => 
    Array.from({ length: width }, () => false)
  );

  // Generate more rooms with varied sizes
  const rooms: Room[] = [];
  const attempts = numRooms * 15;

  for (let i = 0; i < attempts && rooms.length < numRooms; i++) {
    const roomWidth = 4 + rng.int(8); // 4-11 (more variety)
    const roomHeight = 3 + rng.int(7); // 3-9 (more variety)
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

  // Connect rooms with more complex corridors
  const doors: [number, number][] = [];
  
  // Connect each room to next (main path)
  for (let i = 1; i < rooms.length; i++) {
    const roomA = rooms[i - 1];
    const roomB = rooms[i];
    const newDoors = connectRooms(tiles, roomA, roomB, rng);
    doors.push(...newDoors);
  }

  // Add branching connections (creates loops and alternate routes)
  const extraConnections = Math.floor(rooms.length / 3);
  for (let i = 0; i < extraConnections; i++) {
    const roomA = rooms[rng.int(rooms.length)];
    const roomB = rooms[rng.int(rooms.length)];
    if (roomA !== roomB) {
      const newDoors = connectRooms(tiles, roomA, roomB, rng);
      doors.push(...newDoors);
    }
  }

  // Add some dead-end branches for exploration (fewer on Floor 4)
  const deadEnds = floor === 4 ? 2 + rng.int(2) : 3 + rng.int(3); // Floor 4: 2-3, others: 3-5
  for (let i = 0; i < deadEnds; i++) {
    const room = rooms[rng.int(rooms.length)];
    createDeadEnd(tiles, room, rng, width, height);
  }

  // Place key, exit, and start with maximum distance
  const start = getCenterOfRoom(rooms[0]);
  
  // Place stairs in last room (far from start)
  const exit = getCenterOfRoom(rooms[rooms.length - 1]);
  
  // Place key in a distant room (not start, not exit)
  let keyRoomIndex = Math.floor(rooms.length * 0.6) + rng.int(Math.floor(rooms.length * 0.3));
  if (keyRoomIndex >= rooms.length) keyRoomIndex = rooms.length - 2;
  if (keyRoomIndex === 0) keyRoomIndex = Math.floor(rooms.length / 2);
  
  const key = getCenterOfRoom(rooms[keyRoomIndex]);

  // Ensure important positions are walkable
  for (const [x, y] of [start, key, exit]) {
    tiles[y][x] = true;
  }

  // Generate searchable objects (more side rooms to explore)
  const searchables = generateSearchables(rooms, rng, start, keyRoomIndex, floor);

  return { width, height, tiles, start, key, exit, rooms, doors, searchables };
}

function generateSearchables(
  rooms: Room[], 
  rng: SeededRng, 
  start: [number, number],
  keyRoomIndex: number,
  floor: number
): Searchable[] {
  const searchables: Searchable[] = [];
  const objectTypes: SearchableType[] = ['cabinet', 'locker', 'box', 'drawer'];
  
  // Determine number of mimics for this floor
  let numMimics = 0;
  switch (floor) {
    case 4: numMimics = 0; break; // No mimics on tutorial floor
    case 3: numMimics = rng.next() < 0.5 ? 0 : 1; break;
    case 2: numMimics = 1; break;
    case 1: numMimics = 1 + (rng.next() < 0.5 ? 1 : 0); break; // 1-2
    case 0: numMimics = 2 + rng.int(2); break; // Block 13: 2-3
  }
  
  // Place 1-2 searchables per room (except start room)
  rooms.forEach((room, roomIndex) => {
    // Skip start room only
    if (roomIndex === 0) return;

    const searchablesInRoom = 1 + rng.int(2); // 1-2 searchables per room
    
    for (let i = 0; i < searchablesInRoom; i++) {
      // Random wall position in room
      const side = rng.int(4); // 0=top, 1=right, 2=bottom, 3=left
      let x: number, y: number;

      switch (side) {
        case 0: // top wall
          x = room.x + 1 + rng.int(Math.max(1, room.width - 2));
          y = room.y;
          break;
        case 1: // right wall
          x = room.x + room.width - 1;
          y = room.y + 1 + rng.int(Math.max(1, room.height - 2));
          break;
        case 2: // bottom wall
          x = room.x + 1 + rng.int(Math.max(1, room.width - 2));
          y = room.y + room.height - 1;
          break;
        case 3: // left wall
        default:
          x = room.x;
          y = room.y + 1 + rng.int(Math.max(1, room.height - 2));
          break;
      }

      // Determine if this is a mimic
      const isMimic = numMimics > 0 && rng.next() < 0.08; // 8% chance per container
      if (isMimic) numMimics--;

      // Generate result with rebalanced loot table
      const roll = rng.next();
      let result: SearchResult;
      let objectType: SearchableType;
      
      if (isMimic) {
        // Mimic always looks like a box
        objectType = 'mimic';
        result = { type: 'mimic_reveal' };
      } else {
        objectType = objectTypes[rng.int(objectTypes.length)];
        
        // Rebalanced loot table:
        // 20% battery (was 25%)
        // 12% health (new)
        // 25% collectibles (15% eth, 7% btc, 3% hemi)
        // 8% clue
        // 35% nothing (was 65%)
        
        if (roll < 0.20) {
          // Battery
          result = { type: 'battery', amount: 8 + rng.int(12) }; // 8-19%
        } else if (roll < 0.32) {
          // Health
          result = { type: 'health', amount: 10 + rng.int(16) }; // 10-25 HP
        } else if (roll < 0.57) {
          // Collectibles
          const collectRoll = rng.next();
          if (collectRoll < 0.60) {
            result = { type: 'collectible', item: 'eth', score: 50 };
          } else if (collectRoll < 0.88) {
            result = { type: 'collectible', item: 'btc', score: 100 };
          } else {
            result = { type: 'collectible', item: 'hemi', score: 250 };
          }
        } else if (roll < 0.65) {
          // Clue
          result = { type: 'clue', id: `clue_${floor}_${roomIndex}_${i}` };
        } else {
          // Nothing
          result = { type: 'nothing' };
        }
      }

      searchables.push({
        x,
        y,
        objectType,
        result,
        isMimic,
      });
    }
  });

  return searchables;
}

function createDeadEnd(
  tiles: boolean[][], 
  fromRoom: Room, 
  rng: SeededRng,
  worldWidth: number,
  worldHeight: number
) {
  // Pick a random edge of the room
  const side = rng.int(4);
  let startX: number, startY: number;
  let dirX: number, dirY: number;
  
  switch (side) {
    case 0: // top
      startX = fromRoom.x + 1 + rng.int(Math.max(1, fromRoom.width - 2));
      startY = fromRoom.y;
      dirX = 0;
      dirY = -1;
      break;
    case 1: // right
      startX = fromRoom.x + fromRoom.width - 1;
      startY = fromRoom.y + 1 + rng.int(Math.max(1, fromRoom.height - 2));
      dirX = 1;
      dirY = 0;
      break;
    case 2: // bottom
      startX = fromRoom.x + 1 + rng.int(Math.max(1, fromRoom.width - 2));
      startY = fromRoom.y + fromRoom.height - 1;
      dirX = 0;
      dirY = 1;
      break;
    case 3: // left
    default:
      startX = fromRoom.x;
      startY = fromRoom.y + 1 + rng.int(Math.max(1, fromRoom.height - 2));
      dirX = -1;
      dirY = 0;
      break;
  }
  
  // Extend corridor for 3-7 tiles
  const length = 3 + rng.int(5);
  let x = startX;
  let y = startY;
  
  for (let i = 0; i < length; i++) {
    x += dirX;
    y += dirY;
    
    if (x < 1 || x >= worldWidth - 1 || y < 1 || y >= worldHeight - 1) break;
    
    tiles[y][x] = true;
    // Make it 2 tiles wide
    if (dirX !== 0 && y + 1 < worldHeight) {
      tiles[y + 1][x] = true;
    } else if (dirY !== 0 && x + 1 < worldWidth) {
      tiles[y][x + 1] = true;
    }
  }
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
