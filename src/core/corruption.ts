import { SeededRng } from './rng';

export type CorruptionEffectType =
  | 'horizontal_shift'
  | 'scanline'
  | 'chromatic'
  | 'hud_flicker'
  | 'static_noise'
  | 'camera_shake'
  | 'visual_glitch';

export interface CorruptionEffect {
  type: CorruptionEffectType;
  intensity: number; // 0-1
  duration: number; // ms
}

export class CorruptionManager {
  private rng: SeededRng;
  private floor: number;
  private lastCorruptionTime: number = 0;
  private baseCorruptionCooldown: number = 12000; // 12 seconds base
  
  constructor(seed: number, floor: number) {
    this.rng = new SeededRng(seed ^ 0xC0FFEE);
    this.floor = floor;
  }
  
  public tryTriggerCorruption(
    now: number,
    curse: number,
    stalkerDist: number,
    hasKey: boolean
  ): CorruptionEffect | null {
    const timeSinceLast = now - this.lastCorruptionTime;
    
    // Floor-based cooldown (higher floors = less corruption)
    let cooldownMultiplier = 1.0;
    switch (this.floor) {
      case 4: cooldownMultiplier = 2.0; break; // Double cooldown (half frequency)
      case 3: cooldownMultiplier = 1.5; break;
      case 2: cooldownMultiplier = 1.0; break;
      case 1: cooldownMultiplier = 0.7; break;
      case 0: cooldownMultiplier = 0.5; break; // Block 13: Very frequent
    }
    
    const cooldown = this.baseCorruptionCooldown * cooldownMultiplier;
    
    if (timeSinceLast < cooldown) return null;
    
    // Calculate trigger chance based on factors
    let chance = 0.08; // Base 8%
    
    // Curse increases corruption
    chance += curse * 0.002; // +0.2% per curse point
    
    // Stalker proximity
    if (stalkerDist < 300) chance += 0.15;
    else if (stalkerDist < 500) chance += 0.08;
    
    // Has key
    if (hasKey) chance += 0.05;
    
    // Floor escalation (lower floor = more corruption)
    const floorEscalation = Math.max(0.5, 1.5 - (this.floor * 0.25));
    chance *= floorEscalation;
    
    if (this.rng.next() < chance) {
      this.lastCorruptionTime = now;
      return this.generateEffect(curse, stalkerDist);
    }
    
    return null;
  }
  
  public triggerOnWallMove(): CorruptionEffect {
    // Always trigger corruption when walls move
    this.lastCorruptionTime = Date.now();
    return {
      type: 'horizontal_shift',
      intensity: 0.6,
      duration: 400,
    };
  }
  
  private generateEffect(curse: number, stalkerDist: number): CorruptionEffect {
    const types: CorruptionEffectType[] = [
      'horizontal_shift',
      'scanline',
      'chromatic',
      'hud_flicker',
      'static_noise',
      'camera_shake',
      'visual_glitch',
    ];
    
    const type = types[this.rng.int(types.length)];
    
    // Intensity based on danger level
    let intensity = 0.2 + this.rng.next() * 0.3; // 0.2-0.5 base
    
    if (curse > 50) intensity += 0.2;
    if (stalkerDist < 200) intensity += 0.3;
    
    intensity = Math.min(0.9, intensity);
    
    // Duration - keep it short
    const duration = 150 + this.rng.int(300); // 150-450ms
    
    return { type, intensity, duration };
  }
}
