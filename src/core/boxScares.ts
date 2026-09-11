import { SeededRng } from './rng';

export type BoxScareType = 
  | 'lid_slam'
  | 'hand_inside'
  | 'object_falls'
  | 'whisper'
  | 'screen_glitch'
  | 'false_mimic'
  | 'wall_shift'
  | 'shadow_figure';

export interface BoxScareEvent {
  type: BoxScareType;
  intensity: 'subtle' | 'moderate' | 'major';
  delay: number; // ms delay before triggering (0 = immediate, positive = during search)
}

export interface BoxScareConfig {
  seed: number;
  floor: number;
}

export class BoxScareManager {
  private rng: SeededRng;
  private floor: number;
  private lastScareTime: number = 0;
  private lastScareType: BoxScareType | null = null;
  private globalCooldown: number = 12000; // 12 seconds between box scares
  private triggerChance: number;
  
  // Available scare types for this run (deterministic selection)
  private availableScares: BoxScareEvent[];
  
  constructor(config: BoxScareConfig) {
    this.rng = new SeededRng(config.seed ^ 0xB0C5CA12);
    this.floor = config.floor;
    
    // Floor-based trigger chance
    switch (this.floor) {
      case 4: this.triggerChance = 0.065; break; // 6.5%
      case 3: this.triggerChance = 0.10; break;  // 10%
      case 2: this.triggerChance = 0.15; break;  // 15%
      case 1: this.triggerChance = 0.20; break;  // 20%
      case 0: this.triggerChance = 0.28; break;  // 28% (Block 13)
      default: this.triggerChance = 0.08; break;
    }
    
    // Define all box scare types
    const allScares: BoxScareEvent[] = [
      { type: 'lid_slam', intensity: 'moderate', delay: 300 },
      { type: 'hand_inside', intensity: 'major', delay: 200 },
      { type: 'object_falls', intensity: 'subtle', delay: 0 },
      { type: 'whisper', intensity: 'subtle', delay: 100 },
      { type: 'screen_glitch', intensity: 'moderate', delay: 0 },
      { type: 'false_mimic', intensity: 'major', delay: 250 },
      { type: 'wall_shift', intensity: 'moderate', delay: 0 },
      { type: 'shadow_figure', intensity: 'major', delay: 0 },
    ];
    
    // Select 4-6 scares for this run (deterministic)
    const numScares = 4 + this.rng.int(3); // 4-6
    this.availableScares = [];
    const indices = Array.from({ length: allScares.length }, (_, i) => i);
    
    for (let i = 0; i < numScares && indices.length > 0; i++) {
      const idx = this.rng.int(indices.length);
      this.availableScares.push(allScares[indices[idx]]);
      indices.splice(idx, 1);
    }
  }
  
  public tryTriggerOnSearch(now: number, hasKey: boolean): BoxScareEvent | null {
    // Check cooldown
    const timeSinceLast = now - this.lastScareTime;
    if (timeSinceLast < this.globalCooldown) {
      return null;
    }
    
    // Calculate trigger chance
    let chance = this.triggerChance;
    
    // Increase chance after getting key
    if (hasKey) {
      chance *= 1.3; // 30% increase
    }
    
    // Check if we trigger
    if (this.rng.next() < chance) {
      return this.selectScare(now);
    }
    
    return null;
  }
  
  private selectScare(now: number): BoxScareEvent | null {
    // Filter out last scare type to avoid repetition
    const candidates = this.availableScares.filter(scare => 
      scare.type !== this.lastScareType
    );
    
    if (candidates.length === 0) {
      // Fallback: use all if we've exhausted options
      return this.availableScares[this.rng.int(this.availableScares.length)];
    }
    
    const selected = candidates[this.rng.int(candidates.length)];
    
    this.lastScareTime = now;
    this.lastScareType = selected.type;
    
    return selected;
  }
  
  public getTriggerChance(): number {
    return this.triggerChance;
  }
}
