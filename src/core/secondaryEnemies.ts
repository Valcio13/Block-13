import { SeededRng } from './rng';

// CRAWLER - Small roaming enemy that patrols and chases briefly
export class Crawler {
  public x: number = 0;
  public y: number = 0;
  public targetX: number = 0;
  public targetY: number = 0;
  public chasing: boolean = false;
  public id: number;
  
  private rng: SeededRng;
  private speed: number = 60; // Slower than stalker
  private chaseSpeed: number = 100;
  private detectionRange: number = 120;
  private chaseStartTime: number = 0;
  private maxChaseDuration: number = 3000; // 3 seconds
  private tileSize: number;
  
  constructor(id: number, seed: number, tileSize: number) {
    this.id = id;
    this.rng = new SeededRng(seed ^ (id * 0x1234));
    this.tileSize = tileSize;
  }
  
  public spawn(playerX: number, playerY: number, walkableTiles: boolean[][]) {
    // Spawn far from player
    const minDistance = 250;
    let attempts = 0;
    
    while (attempts < 50) {
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
          this.pickPatrolTarget(walkableTiles);
          return;
        }
      }
      
      attempts++;
    }
    
    // Fallback
    this.x = 100;
    this.y = 100;
    this.targetX = this.x;
    this.targetY = this.y;
  }
  
  public update(delta: number, playerX: number, playerY: number, walkableTiles: boolean[][]): boolean {
    const distToPlayer = Math.sqrt(
      Math.pow(this.x - playerX, 2) + Math.pow(this.y - playerY, 2)
    );
    
    const now = Date.now();
    
    if (this.chasing) {
      // Chase player
      this.targetX = playerX;
      this.targetY = playerY;
      this.moveTowardsTarget(this.chaseSpeed, delta);
      
      // Check if caught player
      if (distToPlayer < 25) return true; // Collision!
      
      // Give up chase after timeout or if player is too far
      if (now - this.chaseStartTime > this.maxChaseDuration || distToPlayer > 300) {
        this.chasing = false;
        this.pickPatrolTarget(walkableTiles);
      }
    } else {
      // Patrol
      this.moveTowardsTarget(this.speed, delta);
      
      // Detect player
      if (distToPlayer < this.detectionRange) {
        this.chasing = true;
        this.chaseStartTime = now;
      }
      
      // Pick new patrol target if reached
      if (this.hasReachedTarget()) {
        this.pickPatrolTarget(walkableTiles);
      }
    }
    
    return false;
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
    return Math.sqrt(dx * dx + dy * dy) < 15;
  }
  
  private pickPatrolTarget(walkableTiles: boolean[][]) {
    let attempts = 0;
    while (attempts < 30) {
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
}

// WATCHER - Stationary apparition that creates pressure when approached
export class Watcher {
  public x: number = 0;
  public y: number = 0;
  public active: boolean = true;
  public illuminatedTime: number = 0;
  public id: number;
  
  private rng: SeededRng;
  private curseRange: number = 150; // Range where it adds curse
  private illuminatedThreshold: number = 4000; // 4 seconds in light to disappear
  private tileSize: number;
  
  constructor(id: number, seed: number, tileSize: number) {
    this.id = id;
    this.rng = new SeededRng(seed ^ (id * 0x5678));
    this.tileSize = tileSize;
  }
  
  public spawn(playerX: number, playerY: number, walkableTiles: boolean[][], rooms: any[]) {
    // Spawn in a dark room/corridor away from player
    const minDistance = 200;
    let attempts = 0;
    
    while (attempts < 50) {
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
          return;
        }
      }
      
      attempts++;
    }
    
    // Fallback
    this.x = 200;
    this.y = 200;
  }
  
  public update(
    delta: number,
    playerX: number,
    playerY: number,
    playerApproaching: boolean,
    illuminated: boolean
  ): number {
    if (!this.active) return 0;
    
    const distToPlayer = Math.sqrt(
      Math.pow(this.x - playerX, 2) + Math.pow(this.y - playerY, 2)
    );
    
    // Track illumination time
    if (illuminated && distToPlayer < 200) {
      this.illuminatedTime += delta;
      
      // Disappear if illuminated too long
      if (this.illuminatedTime > this.illuminatedThreshold) {
        this.active = false;
        return 0;
      }
    } else {
      // Reset if not being illuminated
      this.illuminatedTime = Math.max(0, this.illuminatedTime - delta * 0.5);
    }
    
    // Apply curse pressure if player is approaching and looking at it
    if (distToPlayer < this.curseRange && playerApproaching) {
      // More curse the closer player is
      const curseFactor = 1 - (distToPlayer / this.curseRange);
      return curseFactor * 2 * (delta / 1000); // ~2 curse per second when very close
    }
    
    return 0;
  }
}

export function spawnSecondaryEnemies(
  floor: number,
  seed: number,
  playerX: number,
  playerY: number,
  walkableTiles: boolean[][],
  rooms: any[],
  tileSize: number
): { crawlers: Crawler[]; watchers: Watcher[] } {
  const rng = new SeededRng(seed ^ 0xE0E01);
  
  // Floor-based population
  let numCrawlers = 0;
  let numWatchers = 0;
  
  switch (floor) {
    case 4:
      numCrawlers = 0;
      numWatchers = 0;
      break;
    case 3:
      numCrawlers = rng.next() < 0.5 ? 0 : 1;
      numWatchers = rng.next() < 0.5 ? 0 : 1;
      break;
    case 2:
      numCrawlers = 1 + rng.int(2); // 1-2
      numWatchers = 1;
      break;
    case 1:
      numCrawlers = 2 + rng.int(2); // 2-3
      numWatchers = 1 + rng.int(2); // 1-2
      break;
    case 0: // Block 13
      numCrawlers = 3 + rng.int(2); // 3-4
      numWatchers = 2 + rng.int(2); // 2-3
      break;
  }
  
  const crawlers: Crawler[] = [];
  for (let i = 0; i < numCrawlers; i++) {
    const crawler = new Crawler(i, seed, tileSize);
    crawler.spawn(playerX, playerY, walkableTiles);
    crawlers.push(crawler);
  }
  
  const watchers: Watcher[] = [];
  for (let i = 0; i < numWatchers; i++) {
    const watcher = new Watcher(i, seed, tileSize);
    watcher.spawn(playerX, playerY, walkableTiles, rooms);
    watchers.push(watcher);
  }
  
  return { crawlers, watchers };
}
