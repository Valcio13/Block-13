# Deterministic Replay Implementation Plan

> **Historical planning document — superseded.** This plan predates the completed Phaser-free authoritative simulation, InputLogV2, FinalStateV1, and current replay tests. For current status and architecture, see [README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

**Status**: IN PROGRESS
**Goal**: Make Block 13 fully deterministic for verified replay

---

## Phase 1: Core Integration ✅ DONE

- ✅ Update inputRecorder.ts with keccak256-based hash
- ✅ SimulationEngine ready
- ✅ InputRecorder ready

---

## Phase 2: FloorScene Integration (IN PROGRESS)

### Files to Modify:
1. **src/game/scenes/FloorScene.ts** - Main integration point

### Changes Required:

#### A. Add SimulationEngine & InputRecorder
```typescript
import { SimulationEngine, TickCooldown } from '../../core/simulationEngine';
import { InputRecorder, type InputState } from '../../core/inputRecorder';

// Add fields
private simulationEngine!: SimulationEngine;
private inputRecorder!: InputRecorder;
private lastDamageTick: number = -Infinity;
private invulnerabilityTicks: number = 60; // 1 second at 60Hz
private keyCollectedTick: number = -Infinity;
```

#### B. Replace update() Method
```typescript
update(time: number, delta: number) {
  // Run fixed timestep simulation
  this.simulationEngine.update(delta, (fixedDelta, tick) => {
    this.fixedUpdate(fixedDelta, tick);
  });
}

fixedUpdate(fixedDelta: number, tick: number) {
  // Capture inputs
  const inputs = this.captureInputs();

  // Record inputs
  this.inputRecorder.recordTick(tick, inputs);

  // Apply inputs
  this.applyInputs(inputs);

  // Run game logic with FIXED delta
  this.handlePlayerMovement(fixedDelta);
  this.handleFlashlight();
  this.updateLighting();
  this.updateStalker(fixedDelta, tick);
  this.updateSecondaryEnemies(fixedDelta, tick);
  this.updateAmbushers(fixedDelta, tick);
  this.updateMovingWalls(tick);
  this.updateCorruption(tick);
  this.drainBattery(fixedDelta);
  this.checkInteractables();
  this.handleInteraction(tick);
  this.checkRoomTransitions(tick);
  this.checkJumpscareConditions(tick);
}
```

---

## Phase 3: Date.now() Replacement

### FloorScene.ts Changes:

#### Replace Damage Timing
```typescript
// OLD:
private canTakeDamage(): boolean {
  const now = Date.now();
  return (now - this.lastDamageTime) >= this.invulnerabilityDuration;
}

// NEW:
private canTakeDamage(currentTick: number): boolean {
  return (currentTick - this.lastDamageTick) >= this.invulnerabilityTicks;
}

// OLD:
this.lastDamageTime = Date.now();

// NEW:
this.lastDamageTick = currentTick;
```

#### Replace Event Triggers
```typescript
// OLD:
const scare = this.jumpscareDirector.tryTriggerOnKeyCollected(Date.now());

// NEW:
const scare = this.jumpscareDirector.tryTriggerOnKeyCollected(currentTick);
```

### Files to Update:
1. **src/core/stalker.ts** - Replace Date.now() with tick counter
2. **src/core/secondaryEnemies.ts** - Replace Date.now() with tick counter
3. **src/core/corruption.ts** - Replace Date.now() with tick counter
4. **src/core/jumpscares.ts** - Replace Date.now() with tick counter
5. **src/core/boxScares.ts** - Replace Date.now() with tick counter
6. **src/core/movingWalls.ts** - Replace Date.now() with tick counter

---

## Phase 4: Math.random() Replacement

### FloorScene.ts Changes:

#### 1. Mimic Twitch Delay (Line 1571)
```typescript
// OLD:
this.time.addEvent({
  delay: 2000 + Math.random() * 3000,
  // ...
});

// NEW: Convert to tick-based state machine
private mimicTwitchTick: number = -Infinity;
private mimicTwitchDelay: number = 0;

// In create():
this.mimicTwitchDelay = 120 + getEventRNG().nextRange(0, 180); // 2-5 seconds

// In fixedUpdate():
if (tick - this.mimicTwitchTick >= this.mimicTwitchDelay) {
  // Trigger twitch
  this.mimicTwitchTick = tick;
  this.mimicTwitchDelay = 120 + getEventRNG().nextRange(0, 180);
}
```

#### 2. Mimic Twitch Movement (Line 1576)
```typescript
// OLD:
x: sprite.x + (Math.random() - 0.5) * 2,
y: sprite.y + (Math.random() - 0.5) * 2,

// NEW:
x: sprite.x + (getEventRNG().nextFloat() - 0.5) * 2,
y: sprite.y + (getEventRNG().nextFloat() - 0.5) * 2,
```

#### 3. Message Selection (Line 1871)
```typescript
// OLD:
const randomMsg = messages[Math.floor(Math.random() * messages.length)];

// NEW:
const randomMsg = messages[getEconomyRNG().nextRange(0, messages.length - 1)];
```

---

## Phase 5: Phaser Time Events Replacement

### 1. Mimic Twitch Animation (Line 1570)

**Convert to tick-based state machine:**

```typescript
// Add to class
private mimicTwitchStates: Map<number, {
  nextTwitchTick: number;
  isActive: boolean;
}> = new Map();

// In searchable creation
this.mimicTwitchStates.set(mimicId, {
  nextTwitchTick: tick + 120 + getEventRNG().nextRange(0, 180),
  isActive: false
});

// In fixedUpdate()
private updateMimicTwitches(tick: number) {
  this.mimicTwitchStates.forEach((state, mimicId) => {
    if (!state.isActive && tick >= state.nextTwitchTick) {
      // Trigger twitch
      const sprite = this.getSearchableSprite(mimicId);
      if (sprite) {
        this.tweens.add({
          targets: sprite,
          x: sprite.x + (getEventRNG().nextFloat() - 0.5) * 2,
          y: sprite.y + (getEventRNG().nextFloat() - 0.5) * 2,
          duration: 100,
          yoyo: true,
        });
      }

      // Schedule next twitch
      state.nextTwitchTick = tick + 120 + getEventRNG().nextRange(0, 180);
    }
  });
}
```

### 2. Mimic Chase (Line 1918)

**Convert to tick-based chase:**

```typescript
// Add to class
private mimicChaseState: {
  isChasing: boolean;
  startTick: number;
  chaseDurationTicks: number;
  mimicSprite: Phaser.GameObjects.Sprite | null;
} = {
  isChasing: false,
  startTick: 0,
  chaseDurationTicks: 120, // 2 seconds
  mimicSprite: null
};

// In handleMimicReveal()
this.mimicChaseState = {
  isChasing: true,
  startTick: tick,
  chaseDurationTicks: 120,
  mimicSprite: sprite
};

// In fixedUpdate()
private updateMimicChase(tick: number) {
  if (!this.mimicChaseState.isChasing) return;

  const elapsed = tick - this.mimicChaseState.startTick;

  if (elapsed >= this.mimicChaseState.chaseDurationTicks) {
    // Despawn mimic
    if (this.mimicChaseState.mimicSprite) {
      this.tweens.add({
        targets: this.mimicChaseState.mimicSprite,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.mimicChaseState.mimicSprite?.destroy();
          this.mimicChaseState.isChasing = false;
        }
      });
    }
  } else {
    // Chase player
    if (this.mimicChaseState.mimicSprite) {
      const sprite = this.mimicChaseState.mimicSprite;
      const dx = this.player.x - sprite.x;
      const dy = this.player.y - sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 10) {
        const speed = 180; // pixels per second
        const moveDistance = (speed * SimulationEngine.FIXED_DELTA_MS) / 1000;
        sprite.x += (dx / dist) * moveDistance;
        sprite.y += (dy / dist) * moveDistance;
      }
    }
  }
}
```

---

## Phase 6: Tick-Based Timing Utilities

### Update All Event Systems:

```typescript
// src/core/jumpscares.ts
export class JumpscareDirector {
  private lastScareTick: number = -Infinity;
  private scareCooldownTicks: number = 300; // 5 seconds

  tryTriggerOnKeyCollected(currentTick: number): JumpscareEvent | null {
    if (currentTick - this.lastScareTick < this.scareCooldownTicks) {
      return null;
    }
    // ... rest of logic
  }
}

// src/core/boxScares.ts
export class BoxScareManager {
  private lastBoxScareTick: number = -Infinity;

  tryTriggerOnSearch(currentTick: number, hasKey: boolean): BoxScareEvent | null {
    // ... tick-based logic
  }
}

// src/core/movingWalls.ts
export class MovingWallSystem {
  private lastWallMoveTick: number = -Infinity;

  tryTriggerWallMove(
    currentTick: number,
    playerX: number,
    playerY: number,
    // ...
  ): WallMoveEvent | null {
    // ... tick-based logic
  }
}

// src/core/corruption.ts
export class CorruptionManager {
  private lastCorruptionTick: number = -Infinity;

  tryTriggerCorruption(
    currentTick: number,
    curse: number,
    stalkerDist: number,
    hasKey: boolean
  ): CorruptionEffect | null {
    // ... tick-based logic
  }
}
```

---

## Phase 7: Stalker AI Update

### src/core/stalker.ts Changes:

```typescript
export class Stalker {
  private stateTimerTicks: number = 0;
  private chaseStartTick: number = 0;
  private lastChaseEndTick: number = 0;
  private retreatCooldownTicks: number = 600; // 10 seconds

  public update(
    delta: number,
    currentTick: number,  // NEW PARAMETER
    playerX: number,
    playerY: number,
    playerFlashlightOn: boolean,
    walkableTiles: boolean[][]
  ): { caught: boolean; visible: boolean } {
    // Convert delta to ticks for movement
    const deltaTicks = 1; // Always 1 at fixed timestep
    this.stateTimerTicks -= deltaTicks;

    // Check cooldown with ticks
    const inCooldown = (currentTick - this.lastChaseEndTick) < this.retreatCooldownTicks;

    // ... rest of logic using ticks instead of Date.now()
  }
}
```

---

## Phase 8: Secondary Enemies Update

### src/core/secondaryEnemies.ts Changes:

```typescript
export class Crawler {
  private lastDetectionTick: number = -Infinity;

  public update(
    delta: number,
    currentTick: number,  // NEW PARAMETER
    playerX: number,
    playerY: number,
    walkableTiles: boolean[][]
  ): boolean {
    // ... tick-based logic
  }
}

export class Watcher {
  private spawnTick: number;
  private lifetimeTicks: number;

  public update(
    delta: number,
    currentTick: number,  // NEW PARAMETER
    playerX: number,
    playerY: number,
    playerApproaching: boolean,
    illuminated: boolean
  ): number {
    // ... tick-based logic
  }
}
```

---

## Phase 9: Audio System (Preserve Cosmetic Timing)

**Note**: Audio cooldowns don't affect gameplay, so can stay wall-clock based

```typescript
// src/core/audioDirector.ts
// NO CHANGES NEEDED - audio is cosmetic
// Date.now() usage here is acceptable
```

---

## Phase 10: UI Timing (Preserve)

**Preserve wall-clock timing for**:
- Victory/defeat time display
- Real-world elapsed time counters
- FPS counters
- Debug displays

These don't affect gameplay determinism.

---

## Files Requiring Changes

### Core Files (8):
1. ✅ src/core/inputRecorder.ts - DONE
2. ✅ src/core/simulationEngine.ts - DONE
3. ⏳ src/core/stalker.ts - Add currentTick parameter
4. ⏳ src/core/secondaryEnemies.ts - Add currentTick parameter
5. ⏳ src/core/corruption.ts - Replace Date.now() with tick
6. ⏳ src/core/jumpscares.ts - Replace Date.now() with tick
7. ⏳ src/core/boxScares.ts - Replace Date.now() with tick
8. ⏳ src/core/movingWalls.ts - Replace Date.now() with tick

### Game Files (1):
9. ⏳ src/game/scenes/FloorScene.ts - Major refactor

### No Changes Needed (3):
- src/core/audioDirector.ts - Cosmetic timing OK
- src/core/run.ts - timeStarted is for display only
- src/web3/entropyFetcher.ts - Not gameplay

---

## Testing Plan

### Determinism Tests:

```typescript
// test/determinism.test.ts
describe('Deterministic Replay', () => {
  it('same manifest + inputs = same output', () => {
    const manifest = createTestManifest();
    const inputs = loadTestInputLog();

    const result1 = replayRun(manifest, inputs);
    const result2 = replayRun(manifest, inputs);

    expect(result1.score).toBe(result2.score);
    expect(result1.finalState).toEqual(result2.finalState);
  });

  it('works across different framerates', () => {
    // Simulate 60 FPS
    const result60 = replayAt60FPS(manifest, inputs);

    // Simulate 144 FPS
    const result144 = replayAt144FPS(manifest, inputs);

    expect(result60.score).toBe(result144.score);
  });
});
```

---

## Implementation Order

1. ✅ Phase 1: Core files ready
2. ⏳ Phase 2: Integrate SimulationEngine into FloorScene
3. ⏳ Phase 3: Replace Date.now() in FloorScene
4. ⏳ Phase 4: Replace Math.random() calls
5. ⏳ Phase 5: Convert Phaser timers to tick-based
6. ⏳ Phase 6: Update all event system files
7. ⏳ Phase 7: Update Stalker AI
8. ⏳ Phase 8: Update Secondary Enemies
9. ⏳ Phase 9: Test determinism
10. ⏳ Phase 10: Document remaining issues

---

## Estimated Time Remaining

- Phase 2-3: 4 hours (FloorScene refactor)
- Phase 4-5: 2 hours (RNG + timers)
- Phase 6-8: 4 hours (Core systems)
- Phase 9-10: 2 hours (Testing)

**Total**: ~12 hours remaining

---

**Status**: Ready to proceed with implementation
