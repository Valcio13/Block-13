import { SeededRng } from './rng';
import { generateProceduralPuzzle, type ProceduralPuzzle, type PuzzleFloor } from './proceduralPuzzles';

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
  /** Deterministic mandatory evidence nodes; their searched bits are replay-derived. */
  objectives: FloorObjective;
  puzzle: ProceduralPuzzle;
  puzzleDevice: [number, number];
  puzzleFallbackSite?: [number, number];
  /** Block 13's deterministic central landmark; absent on ordinary floors. */
  block13Hub?: [number, number];
};

export type Room = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SearchableType = 'cabinet' | 'locker' | 'box' | 'drawer' | 'mimic' | 'maintenance_lockbox';

export type SearchResult =
  | { type: 'battery'; amount: number }
  | { type: 'health'; amount: number }
  | { type: 'collectible'; item: 'eth' | 'btc' | 'hemi'; score: number }
  | { type: 'clue'; id: string }
  | { type: 'nothing' }
  | { type: 'staircase_key' }
  | { type: 'mimic_reveal' }; // Special result for mimics

export type Searchable = {
  x: number;
  y: number;
  objectType: SearchableType;
  result: SearchResult;
  isMimic: boolean; // Track if this is a mimic
  objectiveStep?: number;
};

export interface FloorObjective {
  title: string;
  clues: readonly string[];
  searchableIndices: number[];
}

export interface FloorLootRng {
  next(): number;
  int(max: number): number;
}

/** Canonical ordinary loot probabilities in percentage points. These
 * cumulative boundaries total exactly 100 and are intentionally explicit. */
export const LOOT_PROBABILITIES = {
  battery: 24,
  health: 18,
  collectible: 25,
  clue: 8,
  empty: 25,
} as const;
export const LOOT_THRESHOLDS = {
  battery: LOOT_PROBABILITIES.battery,
  health: LOOT_PROBABILITIES.battery + LOOT_PROBABILITIES.health,
  collectible: LOOT_PROBABILITIES.battery + LOOT_PROBABILITIES.health + LOOT_PROBABILITIES.collectible,
  clue: LOOT_PROBABILITIES.battery + LOOT_PROBABILITIES.health + LOOT_PROBABILITIES.collectible + LOOT_PROBABILITIES.clue,
} as const;

/** Keep searchable containers readable as separate exploration beats. */
const SEARCHABLE_MIN_MANHATTAN_DISTANCE = 2;

function searchableSpacingAllowed(x: number, y: number, occupied: ReadonlySet<string>): boolean {
  for (const key of occupied) {
    const [occupiedX, occupiedY] = key.split(',').map(Number);
    if (Math.abs(x - occupiedX) + Math.abs(y - occupiedY) < SEARCHABLE_MIN_MANHATTAN_DISTANCE) return false;
  }
  return true;
}

function searchableClusterAllowed(x: number, y: number, occupied: ReadonlySet<string>): boolean {
  const points = [...occupied].map(key => key.split(',').map(Number) as [number, number]);
  const nearby = points.filter(([px, py]) => Math.abs(x - px) + Math.abs(y - py) <= SEARCHABLE_MIN_MANHATTAN_DISTANCE);
  if (nearby.length >= 2) return false;
  return !points.some(([px, py], index) => points.slice(index + 1).some(([qx, qy]) => {
    const pairDistance = Math.abs(px - qx) + Math.abs(py - qy);
    return pairDistance <= SEARCHABLE_MIN_MANHATTAN_DISTANCE
      && (Math.abs(x - px) + Math.abs(y - py) <= SEARCHABLE_MIN_MANHATTAN_DISTANCE
        || Math.abs(x - qx) + Math.abs(y - qy) <= SEARCHABLE_MIN_MANHATTAN_DISTANCE);
  }));
}

export function generateFloor(seed: number, floor: number, lootRng?: FloorLootRng): Floor {
  const rng = new SeededRng(seed ^ ((floor + 1) * 0x9e3779b9));

  // The new ruleset gives each ordinary floor more distinct destinations.
  let width: number, height: number, numRooms: number;

  if (floor === 4) {
    width = 39;
    height = 33;
    numRooms = 9 + rng.int(3); // 9-11 rooms
  } else if (floor === 3) {
    width = 43;
    height = 37;
    numRooms = 12 + rng.int(3); // 12-14 rooms
  } else if (floor === 2) {
    width = 45;
    height = 39;
    numRooms = 14 + rng.int(3); // 14-16 rooms
  } else if (floor === 1) {
    width = 47;
    height = 41;
    numRooms = 16 + rng.int(3); // 16-18 rooms
  } else {
    // Floor 13 remains a surreal reconstruction at the same expanded scale.
    width = 47;
    height = 41;
    numRooms = 14 + rng.int(3); // 14-16 rooms
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

  const legacyKey = getCenterOfRoom(rooms[keyRoomIndex]);

  // Block 13 keeps the seeded rooms and objectives, but joins them through a
  // recognizable central chamber with deterministic branches. This changes
  // only floor 0 and consumes no extra RNG.
  const block13Hub = floor === 0
    ? carveBlock13Hub(tiles, width, height, start, legacyKey, exit)
    : undefined;

  // Ensure important positions are walkable
  for (const [x, y] of [start, legacyKey, exit]) {
    tiles[y][x] = true;
  }

  // Generate searchable objects (more side rooms to explore)
  const searchables = generateSearchables(rooms, lootRng ?? rng, start, keyRoomIndex, floor);

  const puzzle = generateProceduralPuzzle(seed, floor as PuzzleFloor);
  const objectiveContent = { title: puzzle.title, clues: puzzle.clueTexts };
  const objectiveSearchables = placeObjectiveSearchables(rooms, tiles, start, exit, searchables, objectiveContent.clues);
  const objective: FloorObjective = {
    title: objectiveContent.title,
    clues: objectiveContent.clues,
    searchableIndices: objectiveSearchables,
  };

  // The normal-block staircase key is represented by one dedicated searchable
  // object. Placement is geometry-derived and consumes no RNG or loot rolls.
  const key = floor === 0 ? legacyKey : chooseMaintenanceLockboxPosition({
    width, height, tiles, start, exit, doors, searchables, floor,
  });
  if (floor !== 0) searchables.push({
    x: key[0], y: key[1], objectType: 'maintenance_lockbox',
    result: { type: 'battery', amount: 20 }, isMimic: false,
  });
  const puzzleSites = choosePuzzleSites(rooms, tiles, start, exit, key, doors, searchables, floor);
  const puzzleDevice = floor === 4 ? [...key] as [number, number] : puzzleSites.device;
  return {
    width, height, tiles, start, key, exit, rooms, doors, searchables, objectives: objective, puzzle,
    puzzleDevice, ...(puzzleSites.fallback ? { puzzleFallbackSite: puzzleSites.fallback } : {}),
    ...(block13Hub ? { block13Hub } : {}),
  };
}

function choosePuzzleSites(
  rooms: Room[], tiles: boolean[][], start: [number, number], exit: [number, number], key: [number, number], doors: [number, number][],
  searchables: Searchable[], floor: number,
): { device: [number, number]; fallback?: [number, number] } {
  const occupied = new Set(searchables.map(item => `${item.x},${item.y}`));
  occupied.add(`${start[0]},${start[1]}`);
  occupied.add(`${exit[0]},${exit[1]}`);
  occupied.add(`${key[0]},${key[1]}`);
  const centers = rooms.slice(1, -1).map((room, roomIndex) => [
    room.x + Math.floor(room.width / 2), room.y + Math.floor(room.height / 2), roomIndex,
  ] as const).filter(([x, y]) => tiles[y]?.[x] && !occupied.has(`${x},${y}`)
    && !doors.some(([dx, dy]) => dx === x && dy === y));
  const roomTiles: Array<[number, number]> = [];
  for (const room of rooms.slice(1, -1)) {
    for (let y = room.y + 1; y < room.y + room.height - 1; y++) for (let x = room.x + 1; x < room.x + room.width - 1; x++) {
      if (tiles[y]?.[x] && !occupied.has(`${x},${y}`) && !doors.some(([dx, dy]) => dx === x && dy === y)) roomTiles.push([x, y]);
    }
  }
  const freeTiles: Array<[number, number]> = [];
  for (let y = 0; y < tiles.length; y++) for (let x = 0; x < tiles[y].length; x++) {
    if (tiles[y][x] && !occupied.has(`${x},${y}`) && !doors.some(([dx, dy]) => dx === x && dy === y)) freeTiles.push([x, y]);
  }
  const fartherFirst = (a: readonly number[], b: readonly number[]) => Math.abs(b[0] - start[0]) + Math.abs(b[1] - start[1])
    - Math.abs(a[0] - start[0]) - Math.abs(a[1] - start[1]);
  centers.sort((a, b) => fartherFirst(a, b) || a[2] - b[2]);
  roomTiles.sort((a, b) => fartherFirst(a, b) || a[1] - b[1] || a[0] - b[0]);
  freeTiles.sort((a, b) => fartherFirst(a, b) || a[1] - b[1] || a[0] - b[0]);
  const device = centers[0] ? [centers[0][0], centers[0][1]] as [number, number] : roomTiles[0] ?? freeTiles[0] ?? [...key] as [number, number];
  const wantsFallback = floor === 4 || floor === 3;
  const fallbackCell = wantsFallback ? (centers.find(([x, y]) => x !== device[0] || y !== device[1])
    ?? roomTiles.find(([x, y]) => x !== device[0] || y !== device[1])
    ?? freeTiles.find(([x, y]) => x !== device[0] || y !== device[1])) : undefined;
  if (wantsFallback && !fallbackCell) throw new Error(`Generated Floor ${floor} has no reachable puzzle fallback site.`);
  return { device, ...(fallbackCell ? { fallback: [fallbackCell[0], fallbackCell[1]] as [number, number] } : {}) };
}

function placeObjectiveSearchables(
  rooms: Room[], tiles: boolean[][], start: [number, number], exit: [number, number],
  searchables: Searchable[], clues: readonly string[],
): number[] {
  const used = new Set(searchables.map(item => `${item.x},${item.y}`));
  const candidates = rooms.slice(1, -1).map((room, order) => {
    const x = room.x + Math.floor(room.width / 2), y = room.y + Math.floor(room.height / 2);
    const distance = Math.abs(x - start[0]) + Math.abs(y - start[1]);
    return { x, y, distance, order };
  }).filter(({ x, y }) => tiles[y]?.[x]
    && !used.has(`${x},${y}`) && (x !== exit[0] || y !== exit[1]));
  candidates.sort((a, b) => b.distance - a.distance || a.order - b.order);
  if (candidates.length < clues.length) throw new Error('Generated floor cannot place all mandatory evidence nodes.');
  const indices: number[] = [];
  for (let step = 0; step < clues.length; step++) {
    const cell = candidates.find(candidate => !used.has(`${candidate.x},${candidate.y}`)
      && searchableClusterAllowed(candidate.x, candidate.y, used))
      ?? candidates.find(candidate => !used.has(`${candidate.x},${candidate.y}`)
        && searchableSpacingAllowed(candidate.x, candidate.y, used))
      ?? candidates.find(candidate => !used.has(`${candidate.x},${candidate.y}`));
    if (!cell) throw new Error('Generated floor cannot place all mandatory evidence nodes.');
    const index = searchables.length;
    searchables.push({
      x: cell.x, y: cell.y, objectType: step % 2 === 0 ? 'drawer' : 'cabinet',
      result: { type: 'clue', id: `objective_${step}` }, isMimic: false, objectiveStep: step,
    });
    used.add(`${cell.x},${cell.y}`);
    indices.push(index);
  }
  return indices;
}

export interface LockboxPlacementInput {
  width: number; height: number; tiles: boolean[][]; start: [number, number]; exit: [number, number];
  doors: [number, number][]; searchables: Searchable[]; floor: number; occupied?: [number, number][];
}

/** Deterministic shortest-path placement. Prefers explored side branches while
 * enforcing floor-specific travel distance; a bounded list and stable ties
 * guarantee a reachable fallback on every generated normal floor. */
export function chooseMaintenanceLockboxPosition(input: LockboxPlacementInput): [number, number] {
  const { width, height, tiles, start, exit, doors, searchables, floor } = input;
  const count = width * height;
  const dirs: Array<[number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const pathDistances = (origin: [number, number]) => {
    const distances = new Int32Array(count); distances.fill(-1);
    const queue = new Int32Array(count);
    const originIndex = origin[1] * width + origin[0];
    distances[originIndex] = 0; queue[0] = originIndex;
    let head = 0, tail = 1;
    while (head < tail) {
      const cell = queue[head++], x = cell % width, y = Math.floor(cell / width);
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy, next = ny * width + nx;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || !tiles[ny]?.[nx] || distances[next] >= 0) continue;
        distances[next] = distances[cell] + 1; queue[tail++] = next;
      }
    }
    return distances;
  };
  const fromStart = pathDistances(start), fromExit = pathDistances(exit);
  const occupied = new Set<string>([
    `${start[0]},${start[1]}`, `${exit[0]},${exit[1]}`,
    ...doors.map(([x, y]) => `${x},${y}`),
    ...searchables.map(({ x, y }) => `${x},${y}`),
    ...(input.occupied ?? []).map(([x, y]) => `${x},${y}`),
  ]);
  const occupiedPoints = [...occupied].map(key => key.split(',').map(Number) as [number, number]);
  const containerPoints = [
    ...searchables.map(({ x, y }) => [x, y] as [number, number]),
    ...(input.occupied ?? []),
  ];
  const nearbyContainerPairs: Array<[[number, number], [number, number]]> = [];
  for (let i = 0; i < containerPoints.length; i++) for (let j = i + 1; j < containerPoints.length; j++) {
    const distance = Math.abs(containerPoints[i][0] - containerPoints[j][0]) + Math.abs(containerPoints[i][1] - containerPoints[j][1]);
    if (distance <= SEARCHABLE_MIN_MANHATTAN_DISTANCE) nearbyContainerPairs.push([containerPoints[i], containerPoints[j]]);
  }
  const minStart = ({ 4: 7, 3: 10, 2: 13, 1: 16 } as Record<number, number>)[floor] ?? 7;
  const minExit = ({ 4: 5, 3: 6, 2: 7, 1: 8 } as Record<number, number>)[floor] ?? 5;
  let best: [number, number] | undefined;
  let bestScore = -Infinity;
  let bestFloor4OpenTile: [number, number] | undefined;
  let bestFloor4OpenScore = -Infinity;
  let bestFloor4SeparatedOpenTile: [number, number] | undefined;
  let bestFloor4SeparatedOpenScore = -Infinity;
  let bestSeparatedFallback: [number, number] | undefined;
  let bestSeparatedFallbackScore = -Infinity;
  let fallback: [number, number] | undefined;
  let fallbackScore = -Infinity;
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    if (!tiles[y]?.[x] || occupied.has(`${x},${y}`)) continue;
    const cellIndex = y * width + x;
    const distance = fromStart[cellIndex], exitDistance = fromExit[cellIndex];
    if (distance < 0 || exitDistance < 0) continue;
    const degree = dirs.reduce((sum, [dx, dy]) => sum + Number(tiles[y + dy]?.[x + dx] === true), 0);
    const branchScore = degree === 1 ? 7 : degree === 2 ? 4 : degree === 3 ? 1 : 0;
    const tooCloseToContainer = occupiedPoints.some(([occupiedX, occupiedY]) => {
      return Math.abs(x - occupiedX) + Math.abs(y - occupiedY) < SEARCHABLE_MIN_MANHATTAN_DISTANCE;
    });
    const nearbyContainerCount = containerPoints.filter(([containerX, containerY]) =>
      Math.abs(x - containerX) + Math.abs(y - containerY) <= SEARCHABLE_MIN_MANHATTAN_DISTANCE).length;
    const extendsNearbyPair = nearbyContainerPairs.some(([[firstX, firstY], [secondX, secondY]]) =>
      Math.abs(x - firstX) + Math.abs(y - firstY) <= SEARCHABLE_MIN_MANHATTAN_DISTANCE
      || Math.abs(x - secondX) + Math.abs(y - secondY) <= SEARCHABLE_MIN_MANHATTAN_DISTANCE);
    // Move the objective away from spawn, but favor a route that is less
    // wasteful to return from; branching geometry adds exploration value.
    const difficulty = distance - exitDistance * 0.35 + branchScore * 3
      + (tooCloseToContainer ? -10000 : 0)
      + (nearbyContainerCount >= 2 || extendsNearbyPair ? -100000 : 0);
    const candidate: [number, number] = [x, y];
    const fallbackCandidateScore = distance + branchScore;
    if (fallbackCandidateScore > fallbackScore) { fallback = candidate; fallbackScore = fallbackCandidateScore; }
    if (!extendsNearbyPair && fallbackCandidateScore > bestSeparatedFallbackScore) {
      bestSeparatedFallback = candidate;
      bestSeparatedFallbackScore = fallbackCandidateScore;
    }
    // The tutorial lockbox is also the puzzle device. Keep it visibly on an
    // open floor area instead of a one-tile dead-end that can read as embedded
    // in the surrounding wall art.
    if (floor === 4 && degree >= 3 && distance >= minStart && exitDistance >= minExit && difficulty > bestFloor4OpenScore) {
      bestFloor4OpenTile = candidate;
      bestFloor4OpenScore = difficulty;
    }
    if (floor === 4 && degree >= 3 && nearbyContainerCount < 2 && !extendsNearbyPair && distance >= minStart
      && exitDistance >= minExit && difficulty > bestFloor4SeparatedOpenScore) {
      bestFloor4SeparatedOpenTile = candidate;
      bestFloor4SeparatedOpenScore = difficulty;
    }
    if (distance >= minStart && exitDistance >= minExit && difficulty > bestScore) { best = candidate; bestScore = difficulty; }
  }
  const chosen = (floor === 4 ? bestFloor4SeparatedOpenTile ?? bestFloor4OpenTile : undefined)
    ?? best ?? bestSeparatedFallback ?? fallback;
  if (!chosen) throw new Error('Generated floor has no reachable Maintenance Lockbox tile.');
  return chosen;
}

/** Create a 9x7 central chamber and H-then-V, one-tile branches to landmarks. */
function carveBlock13Hub(
  tiles: boolean[][],
  width: number,
  height: number,
  start: [number, number],
  key: [number, number],
  exit: [number, number],
): [number, number] {
  const hub: [number, number] = [Math.floor(width / 2), Math.floor(height / 2)];
  const [cx, cy] = hub;
  for (let y = cy - 3; y <= cy + 3; y++) {
    for (let x = cx - 4; x <= cx + 4; x++) {
      if (x > 0 && x < width - 1 && y > 0 && y < height - 1) tiles[y][x] = true;
    }
  }
  for (const [targetX, targetY] of [start, key, exit]) {
    let x = cx, y = cy;
    while (x !== targetX) {
      x += Math.sign(targetX - x);
      tiles[y][x] = true;
    }
    while (y !== targetY) {
      y += Math.sign(targetY - y);
      tiles[y][x] = true;
    }
  }
  return hub;
}

function generateSearchables(
  rooms: Room[],
  rng: FloorLootRng,
  start: [number, number],
  keyRoomIndex: number,
  floor: number
): Searchable[] {
  const searchables: Searchable[] = [];
  const occupiedSearchableTiles = new Set<string>();
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
      const [x, y] = chooseUniqueSearchablePosition(room, rng, occupiedSearchableTiles);
      occupiedSearchableTiles.add(`${x},${y}`);

      // Consume a fixed six-draw loot budget for every container. Keeping all
      // outcome-specific rolls unconditional means changing category
      // thresholds cannot change later RNG positions or draw order.
      const mimicRoll = rng.next();
      const roll = rng.next();
      const objectTypeRoll = rng.int(objectTypes.length);
      const batteryAmountRoll = rng.int(12);
      const healthAmountRoll = rng.int(16);
      const collectRoll = rng.next();

      // Determine if this is a mimic. The roll is consumed even when the
      // floor has no remaining Mimic slots, preserving fixed cadence.
      const isMimic = numMimics > 0 && mimicRoll < 0.08;
      if (isMimic) numMimics--;

      let result: SearchResult;
      let objectType: SearchableType;

      if (isMimic) {
        // Mimic always looks like a box
        objectType = 'mimic';
        result = { type: 'mimic_reveal' };
      } else {
        objectType = objectTypes[objectTypeRoll];

        if (roll < LOOT_THRESHOLDS.battery / 100) {
          // Battery
          result = { type: 'battery', amount: 8 + batteryAmountRoll }; // 8-19%
        } else if (roll < LOOT_THRESHOLDS.health / 100) {
          // Health
          result = { type: 'health', amount: 10 + healthAmountRoll }; // 10-25 HP
        } else if (roll < LOOT_THRESHOLDS.collectible / 100) {
          // Collectibles
          if (collectRoll < 0.60) {
            result = { type: 'collectible', item: 'eth', score: 50 };
          } else if (collectRoll < 0.88) {
            result = { type: 'collectible', item: 'btc', score: 100 };
          } else {
            result = { type: 'collectible', item: 'hemi', score: 250 };
          }
        } else if (roll < LOOT_THRESHOLDS.clue / 100) {
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

/** Choose a normal wall position, preserving the original RNG draw count on collisions. */
function chooseUniqueSearchablePosition(
  room: Room,
  rng: FloorLootRng,
  occupied: ReadonlySet<string>,
): [number, number] {
  const candidateAt = (side: number): [number, number] => {
    switch (side) {
      case 0: return [room.x + 1 + rng.int(Math.max(1, room.width - 2)), room.y];
      case 1: return [room.x + room.width - 1, room.y + 1 + rng.int(Math.max(1, room.height - 2))];
      case 2: return [room.x + 1 + rng.int(Math.max(1, room.width - 2)), room.y + room.height - 1];
      default: return [room.x, room.y + 1 + rng.int(Math.max(1, room.height - 2))];
    }
  };

  // The original generator consumed exactly one side draw and one position
  // draw here. Keep that count stable so a placement collision cannot shift
  // subsequent loot types, Mimic decisions, or floor generation.
  const candidate = candidateAt(rng.int(4));
  if (!occupied.has(`${candidate[0]},${candidate[1]}`) && searchableClusterAllowed(candidate[0], candidate[1], occupied)) return candidate;

  // A room has several valid wall cells even at the minimum generated size.
  // If the selected cell is already occupied, pick the nearest free wall cell
  // with stable enumeration tie-breaking and no additional RNG consumption.
  const candidates: [number, number][] = [];
  for (let x = room.x + 1; x < room.x + room.width - 1; x++) {
    candidates.push([x, room.y], [x, room.y + room.height - 1]);
  }
  for (let y = room.y + 1; y < room.y + room.height - 1; y++) {
    candidates.push([room.x, y], [room.x + room.width - 1, y]);
  }
  const available = candidates.filter(([x, y]) => !occupied.has(`${x},${y}`));
  if (available.length === 0) throw new Error('No unoccupied wall tile available for searchable object');
  const spaced = available.filter(([x, y]) => searchableClusterAllowed(x, y, occupied));
  if (spaced.length) {
    let best = spaced[0];
    let bestDistance = Math.min(...[...occupied].map(key => {
      const [ox, oy] = key.split(',').map(Number);
      return Math.abs(best[0] - ox) + Math.abs(best[1] - oy);
    }));
    for (const current of spaced.slice(1)) {
      const distance = Math.min(...[...occupied].map(key => {
        const [ox, oy] = key.split(',').map(Number);
        return Math.abs(current[0] - ox) + Math.abs(current[1] - oy);
      }));
      if (distance > bestDistance) { best = current; bestDistance = distance; }
    }
    return best;
  }
  // If the room is saturated by nearby containers, choose the wall tile that
  // maximizes its distance from all existing containers. This keeps the
  // fallback deterministic while avoiding a visible same-room pile-up.
  let best = available[0];
  let bestDistance = -Infinity;
  for (const current of available) {
    const distance = occupied.size === 0 ? 0 : Math.min(...[...occupied].map(key => {
      const [ox, oy] = key.split(',').map(Number);
      return Math.abs(current[0] - ox) + Math.abs(current[1] - oy);
    }));
    if (distance > bestDistance) { best = current; bestDistance = distance; }
  }
  return best;
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
    case 1: // righ
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
    case 3: // lef
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
