import { SeededRng } from './rng';

export type JumpscareType = 
  | 'light_flicker'
  | 'door_slam'
  | 'footsteps'
  | 'shadow_cross'
  | 'false_stalker'
  | 'object_move'
  | 'sudden_noise'
  | 'screen_glitch';

export interface JumpscareEvent {
  type: JumpscareType;
  intensity: 'subtle' | 'moderate' | 'major';
  canAlertStalker: boolean;
}

export interface JumpscareConfig {
  seed: number;
  floor: number;
}

export class JumpscareDirector {
  private rng: SeededRng;
  private floor: number;
  private availableScares: JumpscareEvent[];
  private lastScareTime: number = 0;
  private lastScareType: JumpscareType | null = null;
  private globalCooldown: number = 15000; // 15 seconds between major scares
  private minorCooldown: number = 8000; // 8 seconds between subtle scares
  private scareCount: number = 0;
  
  constructor(config: JumpscareConfig) {
    this.rng = new SeededRng(config.seed ^ 0xBADF00D);
    this.floor = config.floor;
    
    // Define all 8 scare types
    const allScares: JumpscareEvent[] = [
      { type: 'light_flicker', intensity: 'subtle', canAlertStalker: false },
      { type: 'door_slam', intensity: 'moderate', canAlertStalker: true },
      { type: 'footsteps', intensity: 'subtle', canAlertStalker: false },
      { type: 'shadow_cross', intensity: 'moderate', canAlertStalker: false },
      { type: 'false_stalker', intensity: 'major', canAlertStalker: true },
      { type: 'object_move', intensity: 'subtle', canAlertStalker: false },
      { type: 'sudden_noise', intensity: 'moderate', canAlertStalker: true },
      { type: 'screen_glitch', intensity: 'major', canAlertStalker: false },
    ];
    
    // Select 3-5 scares for this run (deterministic)
    const numScares = 3 + this.rng.int(3);
    this.availableScares = [];
    const indices = Array.from({ length: allScares.length }, (_, i) => i);
    
    for (let i = 0; i < numScares && indices.length > 0; i++) {
      const idx = this.rng.int(indices.length);
      this.availableScares.push(allScares[indices[idx]]);
      indices.splice(idx, 1);
    }
  }
  
  public canTriggerScare(now: number, intensity: 'subtle' | 'moderate' | 'major'): boolean {
    const timeSinceLastScare = now - this.lastScareTime;
    
    if (intensity === 'major' && timeSinceLastScare < this.globalCooldown) {
      return false;
    }
    
    if (intensity === 'moderate' && timeSinceLastScare < this.minorCooldown) {
      return false;
    }
    
    if (intensity === 'subtle' && timeSinceLastScare < 5000) {
      return false;
    }
    
    return true;
  }
  
  public tryTriggerOnSearch(now: number, hasKey: boolean): JumpscareEvent | null {
    if (!this.canTriggerScare(now, 'moderate')) return null;
    
    // Higher chance of scares after getting key
    const baseChance = hasKey ? 0.3 : 0.15;
    
    if (this.rng.next() < baseChance) {
      return this.selectScare(now, ['subtle', 'moderate']);
    }
    
    return null;
  }
  
  public tryTriggerOnRoomEnter(now: number, hasKey: boolean): JumpscareEvent | null {
    if (!this.canTriggerScare(now, 'subtle')) return null;
    
    // Rare environmental scares
    const chance = hasKey ? 0.12 : 0.06;
    
    if (this.rng.next() < chance) {
      return this.selectScare(now, ['subtle']);
    }
    
    return null;
  }
  
  public tryTriggerOnKeyCollected(now: number): JumpscareEvent | null {
    if (!this.canTriggerScare(now, 'major')) return null;
    
    // High chance of moderate/major scare when collecting key
    if (this.rng.next() < 0.7) {
      return this.selectScare(now, ['moderate', 'major']);
    }
    
    return null;
  }
  
  public tryTriggerOnLowBattery(now: number, battery: number): JumpscareEvent | null {
    if (battery > 20) return null;
    if (!this.canTriggerScare(now, 'subtle')) return null;
    
    // Occasional subtle scares when battery is critically low
    if (this.rng.next() < 0.1) {
      return this.selectScare(now, ['subtle']);
    }
    
    return null;
  }
  
  public tryTriggerNearStairs(now: number, hasKey: boolean, distToStairs: number): JumpscareEvent | null {
    if (!hasKey || distToStairs > 200) return null;
    if (!this.canTriggerScare(now, 'moderate')) return null;
    
    // Approaching stairs with key can trigger moderate scares
    if (this.rng.next() < 0.15) {
      return this.selectScare(now, ['moderate']);
    }
    
    return null;
  }
  
  private selectScare(now: number, allowedIntensities: ('subtle' | 'moderate' | 'major')[]): JumpscareEvent | null {
    // Filter available scares by intensity
    const candidates = this.availableScares.filter(scare => 
      allowedIntensities.includes(scare.intensity) &&
      scare.type !== this.lastScareType // Don't repeat same scare
    );
    
    if (candidates.length === 0) return null;
    
    const selected = candidates[this.rng.int(candidates.length)];
    
    this.lastScareTime = now;
    this.lastScareType = selected.type;
    this.scareCount++;
    
    return selected;
  }
  
  public getScareTriggerChance(): number {
    // Floor-based scare frequency
    switch (this.floor) {
      case 3: return 0.6; // Less frequent
      case 2: return 0.8;
      case 1: return 1.0; // Most frequent
      default: return 0.5;
    }
  }
}
