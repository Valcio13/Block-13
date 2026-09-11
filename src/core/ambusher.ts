import { SeededRng } from './rng';

export type AmbusherState = 'hidden' | 'warning' | 'revealing' | 'rushing' | 'retreating' | 'inactive';

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
  public alpha: number = 0; // Visibility
  
  private rng: SeededRng;
  private floor: number;
  private tileSize: number;
  private stateTimer: number = 0;
  private targetX: number = 0;
  private targetY: number = 0;
  
  // Behavior parameters
  private detectionRange: number = 120; // Range to detect player
  private warningDuration: number = 800; // Brief warning before reveal
  private revealDuration: number = 1200; // How long reveal lasts
  private rushDuration: number = 1500; // How long it rushes
  private rushSpeed: number = 140; // Speed during rush
  private retreatSpeed: number = 180; // Speed during retreat
  private damage: number = 7; // HP damage on contact
  private curseAmount: number = 8; // Curse on contact
  
  constructor(config: AmbusherConfig) {
    this.id = config.id;
    this.rng = new SeededRng(config.seed ^ (config.id * 0xAB345));
    this.floor = config.floor;
    this.tileSize = config.tileSize;
    
    // Floor-based parameter scaling
    if (this.floor <= 1) {
      this.damage = 8; // Slightly more dangerous on hard floors
      this.curseAmount = 10;
      this.rushSpeed = 160;
    }
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
  ): { shouldReveal: boolean; contacted: boolean } {
    this.stateTimer -= delta;
    
    const distToPlayer = Math.sqrt(
      Math.pow(this.x - playerX, 2) + Math.pow(this.y - playerY, 2)
    );
    
    let shouldReveal = false;
    let contacted = false;
    
    switch (this.state) {
      case 'hidden':
        // Check if player entered detection range
        if (distToPlayer < this.detectionRange) {
          this.state = 'warning';
          this.stateTimer = this.warningDuration;
          this.alpha = 0.2; // Subtle visibility
          shouldReveal = true;
        }
        
        // Check if player searching nearby
        if (playerSearching && nearbySearchX !== undefined && nearbySearchY !== undefined) {
          const distToSearch = Math.sqrt(
            Math.pow(this.x - nearbySearchX, 2) + Math.pow(this.y - nearbySearchY, 2)
          );
          
          if (distToSearch < 150 && this.rng.next() < 0.4) {
            this.state = 'warning';
            this.stateTimer = this.warningDuration;
            this.alpha = 0.2;
            shouldReveal = true;
          }
        }
        break;
        
      case 'warning':
        // Gradually increase visibility during warning
        this.alpha = Math.min(0.5, this.alpha + 0.02);
        
        if (this.stateTimer <= 0) {
          this.state = 'revealing';
          this.stateTimer = this.revealDuration;
        }
        break;
        
      case 'revealing':
        // Fully visible, preparing to rush
        this.alpha = Math.min(1.0, this.alpha + 0.05);
        
        if (this.stateTimer <= 0) {
          this.state = 'rushing';
          this.stateTimer = this.rushDuration;
          this.targetX = playerX;
          this.targetY = playerY;
        }
        break;
        
      case 'rushing':
        // Move toward player's last known position
        this.moveTowardsTarget(this.rushSpeed, delta);
        
        // Check for contact
        if (distToPlayer < 30) {
          contacted = true;
          this.state = 'retreating';
          this.stateTimer = 2000;
          this.pickRetreatTarget(playerX, playerY);
        }
        
        // Timeout - retreat anyway
        if (this.stateTimer <= 0) {
          this.state = 'retreating';
          this.stateTimer = 2000;
          this.pickRetreatTarget(playerX, playerY);
        }
        break;
        
      case 'retreating':
        this.moveTowardsTarget(this.retreatSpeed, delta);
        this.alpha = Math.max(0, this.alpha - 0.03);
        
        if (this.stateTimer <= 0 || this.hasReachedTarget()) {
          this.state = 'inactive';
          this.alpha = 0;
        }
        break;
        
      case 'inactive':
        this.alpha = 0;
        break;
    }
    
    return { shouldReveal, contacted };
  }
  
  private moveTowardsTarget(speed: number, delta: number) {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 5) {
      const moveDistance = (speed * delta) / 1000;
      const ratio = Math.min(moveDistance / distance, 1);
      
      this.x += dx * ratio;
      this.y += dy * ratio;
    }
  }
  
  private hasReachedTarget(): boolean {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    return Math.sqrt(dx * dx + dy * dy) < 20;
  }
  
  private pickRetreatTarget(playerX: number, playerY: number) {
    // Retreat away from player
    const angle = Math.atan2(this.y - playerY, this.x - playerX);
    const retreatDistance = 300;
    
    this.targetX = this.x + Math.cos(angle) * retreatDistance;
    this.targetY = this.y + Math.sin(angle) * retreatDistance;
  }
  
  public getDamage(): number {
    return this.damage;
  }
  
  public getCurse(): number {
    return this.curseAmount;
  }
  
  public isActive(): boolean {
    return this.state !== 'inactive' && this.state !== 'hidden';
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
