import { SeededRng } from './rng';

export type AmbusherState = 'hidden' | 'warning' | 'jumpscare' | 'inactive';

export interface AmbusherConfig {
  id: number;
  seed: number;
  floor: number;
  tileSize: number;
}

export class Ambusher {
  public x: number = 0;
  public y: number = 0;
  public state: AmbusherState = 'hidden';
  public id: number;
  public alpha: number = 0; // Visibility for world sprite
  public hasTriggered: boolean = false; // Only triggers once
  
  private rng: SeededRng;
  private floor: number;
  private tileSize: number;
  private stateTimer: number = 0;
  
  // Behavior parameters
  private detectionRange: number = 120; // Range to detect player
  private warningDuration: number; // Very brief warning (150-400ms)
  private damage: number; // HP damage only
  
  constructor(config: AmbusherConfig) {
    this.id = config.id;
    this.rng = new SeededRng(config.seed ^ (config.id * 0xAB345));
    this.floor = config.floor;
    this.tileSize = config.tileSize;
    
    // Randomize warning duration for unpredictability (150-400ms)
    this.warningDuration = 150 + this.rng.int(251); // 150-400ms
    
    // Damage: 5-8 HP only, no curse
    this.damage = 5 + this.rng.int(4); // 5-8 HP
  }
  
  public spawn(playerX: number, playerY: number, walkableTiles: boolean[][], rooms: any[]) {
    // Spawn in a valid hiding location away from player
    const minDistance = 200;
    const maxDistance = 400;
    let attempts = 0;
    
    while (attempts < 100) {
      // Pick a random room (not the start room)
      const roomIndex = 1 + this.rng.int(rooms.length - 1);
      const room = rooms[roomIndex];
      
      // Pick a position along a wall (hiding spot)
      const side = this.rng.int(4); // 0=top, 1=right, 2=bottom, 3=left
      let tileX: number, tileY: number;
      
      switch (side) {
        case 0: // top wall
          tileX = room.x + this.rng.int(room.width);
          tileY = room.y;
          break;
        case 1: // right wall
          tileX = room.x + room.width - 1;
          tileY = room.y + this.rng.int(room.height);
          break;
        case 2: // bottom wall
          tileX = room.x + this.rng.int(room.width);
          tileY = room.y + room.height - 1;
          break;
        case 3: // left wall
        default:
          tileX = room.x;
          tileY = room.y + this.rng.int(room.height);
          break;
      }
      
      const worldX = tileX * this.tileSize + this.tileSize / 2;
      const worldY = tileY * this.tileSize + this.tileSize / 2;
      
      const distance = Math.sqrt(
        Math.pow(worldX - playerX, 2) + Math.pow(worldY - playerY, 2)
      );
      
      if (distance > minDistance && distance < maxDistance) {
        this.x = worldX;
        this.y = worldY;
        this.state = 'hidden';
        this.alpha = 0;
        return;
      }
      
      attempts++;
    }
    
    // Fallback: spawn far from player
    this.x = playerX + 300;
    this.y = playerY + 300;
    this.state = 'hidden';
    this.alpha = 0;
  }
  
  public update(
    delta: number,
    playerX: number,
    playerY: number,
    playerSearching: boolean,
    nearbySearchX?: number,
    nearbySearchY?: number
  ): { shouldJumpscare: boolean } {
    // Skip if already triggered
    if (this.hasTriggered) {
      return { shouldJumpscare: false };
    }
    
    this.stateTimer -= delta;
    
    const distToPlayer = Math.sqrt(
      Math.pow(this.x - playerX, 2) + Math.pow(this.y - playerY, 2)
    );
    
    let shouldJumpscare = false;
    
    switch (this.state) {
      case 'hidden':
        // Check if player entered detection range
        if (distToPlayer < this.detectionRange) {
          this.state = 'warning';
          this.stateTimer = this.warningDuration;
          this.alpha = 0.15; // Very subtle visibility (just eyes/shadow)
        }
        
        // Check if player searching nearby
        if (playerSearching && nearbySearchX !== undefined && nearbySearchY !== undefined) {
          const distToSearch = Math.sqrt(
            Math.pow(this.x - nearbySearchX, 2) + Math.pow(this.y - nearbySearchY, 2)
          );
          
          if (distToSearch < 150 && this.rng.next() < 0.4) {
            this.state = 'warning';
            this.stateTimer = this.warningDuration;
            this.alpha = 0.15;
          }
        }
        break;
        
      case 'warning':
        // Very subtle visibility increase during brief warning
        this.alpha = Math.min(0.25, this.alpha + 0.01);
        
        if (this.stateTimer <= 0) {
          // TRIGGER JUMPSCARE!
          this.state = 'jumpscare';
          this.hasTriggered = true;
          shouldJumpscare = true;
        }
        break;
        
      case 'jumpscare':
        // Jumpscare is handled by scene, ambusher becomes inactive immediately
        this.state = 'inactive';
        this.alpha = 0;
        break;
        
      case 'inactive':
        this.alpha = 0;
        break;
    }
    
    return { shouldJumpscare };
  }
  
  public getDamage(): number {
    return this.damage;
  }
  
  public getWarningDuration(): number {
    return this.warningDuration;
  }
  
  public isActive(): boolean {
    return this.state !== 'inactive' && !this.hasTriggered;
  }
}

export function spawnAmbushers(
  floor: number,
  seed: number,
  playerX: number,
  playerY: number,
  walkableTiles: boolean[][],
  rooms: any[],
  tileSize: number
): Ambusher[] {
  const rng = new SeededRng(seed ^ 0xA3B051);
  
  // Floor-based spawn counts
  let numAmbushers = 0;
  
  switch (floor) {
    case 4:
      numAmbushers = rng.next() < 0.5 ? 0 : 1; // 0-1
      break;
    case 3:
      numAmbushers = 1;
      break;
    case 2:
      numAmbushers = 1 + rng.int(2); // 1-2
      break;
    case 1:
      numAmbushers = 2;
      break;
    case 0: // Block 13
      numAmbushers = 2 + rng.int(2); // 2-3
      break;
  }
  
  const ambushers: Ambusher[] = [];
  
  for (let i = 0; i < numAmbushers; i++) {
    const ambusher = new Ambusher({
      id: i,
      seed,
      floor,
      tileSize,
    });
    
    ambusher.spawn(playerX, playerY, walkableTiles, rooms);
    ambushers.push(ambusher);
  }
  
  return ambushers;
}
