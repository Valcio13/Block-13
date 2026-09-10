import { SeededRng } from './rng';
import type { Room } from './floor';

export interface Wall {
  x: number;
  y: number;
  horizontal: boolean; // true = horizontal wall, false = vertical
  length: number;
  active: boolean;
}

export interface WallMoveEvent {
  wall: Wall;
  closing: boolean; // true = wall appears, false = wall disappears
}

export class MovingWallSystem {
  private rng: SeededRng;
  private floor: number;
  private tiles: boolean[][];
  private walls: Wall[] = [];
  private lastMoveTime: number = 0;
  private moveCooldown: number = 30000; // 30 seconds base
  
  constructor(seed: number, floor: number, tiles: boolean[][]) {
    this.rng = new SeededRng(seed ^ 0xFA115);
    this.floor = floor;
    this.tiles = tiles;
    
    // Identify potential moving walls (corridor sections)
    this.identifyPotentialWalls();
  }
  
  private identifyPotentialWalls() {
    const width = this.tiles[0].length;
    const height = this.tiles.length;
    
    // Look for corridors that could be blocked
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        if (!this.tiles[y][x]) continue; // Must be walkable
        
        // Check for horizontal corridor (walls above and below)
        if (!this.tiles[y-1][x] && !this.tiles[y+1][x] &&
            this.tiles[y][x-1] && this.tiles[y][x+1]) {
          // Potential horizontal wall
          let length = 1;
          while (x + length < width && this.tiles[y][x + length] &&
                 !this.tiles[y-1][x + length] && !this.tiles[y+1][x + length]) {
            length++;
          }
          
          if (length >= 2) {
            this.walls.push({
              x,
              y,
              horizontal: true,
              length,
              active: false,
            });
            x += length - 1; // Skip checked tiles
          }
        }
        
        // Check for vertical corridor (walls left and right)
        if (!this.tiles[y][x-1] && !this.tiles[y][x+1] &&
            this.tiles[y-1][x] && this.tiles[y+1][x]) {
          // Potential vertical wall
          let length = 1;
          while (y + length < height && this.tiles[y + length][x] &&
                 !this.tiles[y + length][x-1] && !this.tiles[y + length][x+1]) {
            length++;
          }
          
          if (length >= 2) {
            this.walls.push({
              x,
              y,
              horizontal: false,
              length,
              active: false,
            });
          }
        }
      }
    }
  }
  
  public tryTriggerWallMove(
    now: number,
    playerX: number,
    playerY: number,
    keyX: number,
    keyY: number,
    stairsX: number,
    stairsY: number,
    hasKey: boolean
  ): WallMoveEvent | null {
    const timeSinceLast = now - this.lastMoveTime;
    
    // Floor-based cooldown and trigger chance
    let cooldown = this.moveCooldown;
    let chance = hasKey ? 0.15 : 0.08;
    
    switch (this.floor) {
      case 4:
        cooldown = this.moveCooldown * 2; // 60s - very rare
        chance *= 0.3; // Much less likely
        break;
      case 3:
        cooldown = this.moveCooldown; // 30s
        break;
      case 2:
        cooldown = this.moveCooldown * 0.7; // 21s
        chance *= 1.2;
        break;
      case 1:
        cooldown = this.moveCooldown * 0.5; // 15s
        chance *= 1.5;
        break;
      case 0: // Block 13
        cooldown = this.moveCooldown * 0.3; // 9s
        chance *= 2.0;
        break;
    }
    
    if (timeSinceLast < cooldown) return null;
    
    if (this.rng.next() > chance) return null;
    
    // Pick a random wall
    if (this.walls.length === 0) return null;
    
    const wall = this.walls[this.rng.int(this.walls.length)];
    const closing = !wall.active; // Toggle wall state
    
    // Validate move is safe
    if (closing) {
      // Temporarily block the wall
      this.toggleWallTiles(wall, false);
      
      // Check if player can still reach objectives
      const canReachObjectives = hasKey
        ? this.canReach(playerX, playerY, stairsX, stairsY)
        : this.canReach(playerX, playerY, keyX, keyY) &&
          this.canReach(playerX, playerY, stairsX, stairsY);
      
      // Restore wall state for now
      this.toggleWallTiles(wall, true);
      
      if (!canReachObjectives) {
        // Unsafe - don't block this route
        return null;
      }
      
      // Check player is not too close to wall
      const minDist = 100; // pixels
      for (let i = 0; i < wall.length; i++) {
        const wx = wall.horizontal ? wall.x + i : wall.x;
        const wy = wall.horizontal ? wall.y : wall.y + i;
        const dist = Math.sqrt(
          Math.pow(playerX - wx * 32, 2) + Math.pow(playerY - wy * 32, 2)
        );
        if (dist < minDist) return null;
      }
    }
    
    // Safe to move wall
    this.lastMoveTime = now;
    wall.active = closing;
    this.toggleWallTiles(wall, !closing);
    
    return { wall, closing };
  }
  
  private toggleWallTiles(wall: Wall, walkable: boolean) {
    for (let i = 0; i < wall.length; i++) {
      const x = wall.horizontal ? wall.x + i : wall.x;
      const y = wall.horizontal ? wall.y : wall.y + i;
      if (y < this.tiles.length && x < this.tiles[0].length) {
        this.tiles[y][x] = walkable;
      }
    }
  }
  
  private canReach(x1: number, y1: number, x2: number, y2: number): boolean {
    // Simple flood-fill pathfinding to check connectivity
    const tileX1 = Math.floor(x1 / 32);
    const tileY1 = Math.floor(y1 / 32);
    const tileX2 = Math.floor(x2 / 32);
    const tileY2 = Math.floor(y2 / 32);
    
    if (tileX1 < 0 || tileY1 < 0 || tileX2 < 0 || tileY2 < 0) return false;
    if (tileY1 >= this.tiles.length || tileY2 >= this.tiles.length) return false;
    if (tileX1 >= this.tiles[0].length || tileX2 >= this.tiles[0].length) return false;
    
    const visited = Array.from({ length: this.tiles.length }, () =>
      Array(this.tiles[0].length).fill(false)
    );
    
    const queue: [number, number][] = [[tileX1, tileY1]];
    visited[tileY1][tileX1] = true;
    
    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      
      if (x === tileX2 && y === tileY2) return true;
      
      // Check 4 directions
      const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && ny >= 0 && ny < this.tiles.length && nx < this.tiles[0].length &&
            !visited[ny][nx] && this.tiles[ny][nx]) {
          visited[ny][nx] = true;
          queue.push([nx, ny]);
        }
      }
      
      // Limit search to prevent infinite loops
      if (queue.length > 1000) return false;
    }
    
    return false;
  }
}
