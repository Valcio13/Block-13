import { SeededRng } from './rng';

export type StalkerState = 'dormant' | 'roaming' | 'investigating' | 'hunting' | 'retreating';

export interface StalkerConfig {
  floor: number;
  seed: number;
  worldWidth: number;
  worldHeight: number;
  tileSize: number;
}

export class Stalker {
  private rng: SeededRng;
  private floor: number;
  private worldWidth: number;
  private worldHeight: number;
  private tileSize: number;
  
  public state: StalkerState = 'dormant';
  public x: number = 0;
  public y: number = 0;
  public targetX: number = 0;
  public targetY: number = 0;
  
  private stateTimer: number = 0;
  private chaseStartTime: number = 0;
  private lastChaseEndTime: number = 0;
  private retreatCooldown: number = 10000; // 10 seconds cooldown after retreat
  
  // Floor-based parameters
  private dormantChance: number;
  private roamSpeed: number;
  private huntSpeed: number;
  private detectionRange: number;
  private investigationDuration: number;
  
  constructor(config: StalkerConfig) {
    this.rng = new SeededRng(config.seed ^ 0xDEADBEEF);
    this.floor = config.floor;
    this.worldWidth = config.worldWidth;
    this.worldHeight = config.worldHeight;
    this.tileSize = config.tileSize;
    
    // Floor-based escalation
    switch (this.floor) {
      case 3: // Floor 3: Mostly dormant, rare appearances
        this.dormantChance = 0.85;
        this.roamSpeed = 50;
        this.huntSpeed = 140;
        this.detectionRange = 150;
        this.investigationDuration = 3000;
        break;
      case 2: // Floor 2: More active, investigates player actions
        this.dormantChance = 0.5;
        this.roamSpeed = 70;
        this.huntSpeed = 160;
        this.detectionRange = 200;
        this.investigationDuration = 4000;
        break;
      case 1: // Floor 1: Aggressive, frequent hunts
        this.dormantChance = 0.2;
        this.roamSpeed = 90;
        this.huntSpeed = 180;
        this.detectionRange = 250;
        this.investigationDuration = 5000;
        break;
      default:
        this.dormantChance = 0.9;
        this.roamSpeed = 50;
        this.huntSpeed = 120;
        this.detectionRange = 150;
        this.investigationDuration = 3000;
    }
  }
  
  public spawn(playerX: number, playerY: number, walkableTiles: boolean[][]) {
    // Spawn stalker far from player to avoid cheap deaths
    const minDistance = 300; // Minimum spawn distance in pixels
    let attempts = 0;
    const maxAttempts = 100;
    
    while (attempts < maxAttempts) {
      const tileX = this.rng.int(walkableTiles[0].length);
      const tileY = this.rng.int(walkableTiles.length);
      
      if (walkableTiles[tileY] && walkableTiles[tileY][tileX]) {
        const worldX = tileX * this.tileSize + this.tileSize / 2;
        const worldY = tileY * this.tileSize + this.tileSize / 2;
        
        const distance = Math.sqrt(
          Math.pow(worldX - playerX, 2) + Math.pow(worldY - playerY, 2)
        );
        
        if (distance > minDistance) {
          this.x = worldX;
          this.y = worldY;
          this.targetX = worldX;
          this.targetY = worldY;
          
          // Initial state based on floor
          if (this.rng.next() < this.dormantChance) {
            this.state = 'dormant';
            this.stateTimer = 5000 + this.rng.int(10000); // 5-15 seconds dormant
          } else {
            this.state = 'roaming';
            this.pickRoamTarget(walkableTiles);
          }
          
          return;
        }
      }
      
      attempts++;
    }
    
    // Fallback: spawn at a far corner
    this.x = this.worldWidth - 100;
    this.y = this.worldHeight - 100;
    this.targetX = this.x;
    this.targetY = this.y;
    this.state = 'dormant';
    this.stateTimer = 5000;
  }
  
  public pickRoamTarget(walkableTiles: boolean[][]) {
    // Pick a random walkable tile to roam to
    let attempts = 0;
    while (attempts < 50) {
      const tileX = this.rng.int(walkableTiles[0].length);
      const tileY = this.rng.int(walkableTiles.length);
      
      if (walkableTiles[tileY] && walkableTiles[tileY][tileX]) {
        this.targetX = tileX * this.tileSize + this.tileSize / 2;
        this.targetY = tileY * this.tileSize + this.tileSize / 2;
        return;
      }
      
      attempts++;
    }
  }
  
  public update(
    delta: number,
    playerX: number,
    playerY: number,
    playerFlashlightOn: boolean,
    walkableTiles: boolean[][]
  ): { caught: boolean; visible: boolean } {
    this.stateTimer -= delta;
    
    const distToPlayer = Math.sqrt(
      Math.pow(this.x - playerX, 2) + Math.pow(this.y - playerY, 2)
    );
    
    // Check if in cooldown after retreat
    const now = Date.now();
    const inCooldown = (now - this.lastChaseEndTime) < this.retreatCooldown;
    
    switch (this.state) {
      case 'dormant':
        if (this.stateTimer <= 0 && !inCooldown) {
          // Transition to roaming
          this.state = 'roaming';
          this.pickRoamTarget(walkableTiles);
        }
        break;
        
      case 'roaming':
        this.moveTowardsTarget(this.roamSpeed, delta);
        
        // Check if player is nearby and flashlight is off
        if (!inCooldown && distToPlayer < this.detectionRange && !playerFlashlightOn) {
          this.state = 'investigating';
          this.targetX = playerX;
          this.targetY = playerY;
          this.stateTimer = this.investigationDuration;
        }
        
        // Pick new roam target if reached current one
        if (this.hasReachedTarget()) {
          this.pickRoamTarget(walkableTiles);
        }
        break;
        
      case 'investigating':
        this.moveTowardsTarget(this.roamSpeed * 1.2, delta);
        
        // If player is very close or flashlight is off, start hunting
        if (!inCooldown && distToPlayer < this.detectionRange * 0.6 && !playerFlashlightOn) {
          this.state = 'hunting';
          this.chaseStartTime = now;
        }
        
        // Investigation timeout
        if (this.stateTimer <= 0 || playerFlashlightOn) {
          this.state = 'retreating';
          this.pickRetreatTarget(playerX, playerY, walkableTiles);
          this.stateTimer = 3000;
        }
        break;
        
      case 'hunting':
        this.targetX = playerX;
        this.targetY = playerY;
        this.moveTowardsTarget(this.huntSpeed, delta);
        
        // Caught player
        if (distToPlayer < 30) {
          return { caught: true, visible: true };
        }
        
        // Give up chase if player uses flashlight or chase too long
        const chaseDuration = now - this.chaseStartTime;
        if (playerFlashlightOn || chaseDuration > 15000) {
          this.state = 'retreating';
          this.pickRetreatTarget(playerX, playerY, walkableTiles);
          this.stateTimer = 3000;
          this.lastChaseEndTime = now;
        }
        break;
        
      case 'retreating':
        this.moveTowardsTarget(this.huntSpeed * 0.8, delta);
        
        if (this.stateTimer <= 0 || this.hasReachedTarget()) {
          this.state = 'dormant';
          this.stateTimer = 5000 + this.rng.int(5000);
        }
        break;
    }
    
    // Determine visibility (closer = more visible, hunting = always visible)
    const visible = this.state === 'hunting' || 
                   (this.state === 'investigating' && distToPlayer < 200) ||
                   (this.state === 'roaming' && distToPlayer < 150);
    
    return { caught: false, visible };
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
  
  private pickRetreatTarget(playerX: number, playerY: number, walkableTiles: boolean[][]) {
    // Pick a point away from the player
    const angle = Math.atan2(this.y - playerY, this.x - playerX);
    const retreatDistance = 300;
    
    const idealX = this.x + Math.cos(angle) * retreatDistance;
    const idealY = this.y + Math.sin(angle) * retreatDistance;
    
    // Clamp to world bounds
    this.targetX = Math.max(50, Math.min(this.worldWidth - 50, idealX));
    this.targetY = Math.max(50, Math.min(this.worldHeight - 50, idealY));
  }
  
  public onPlayerSearch() {
    // Hook for when player searches - can alert stalker
    if (this.state === 'dormant' && this.rng.next() < 0.3) {
      this.state = 'investigating';
      this.stateTimer = this.investigationDuration;
    }
  }
  
  public onFlashlightToggle(isOn: boolean) {
    // Hook for flashlight usage - can deter or alert stalker
    if (isOn && this.state === 'hunting') {
      // Flashlight deters hunting
      if (this.rng.next() < 0.7) {
        this.state = 'retreating';
        this.stateTimer = 2000;
      }
    }
  }
}
