# Block 13 Extended Jumpscare System

## Overview

Extended Block 13's horror system with interaction-triggered box scares and hidden enemy ambushes. All existing systems preserved and enhanced with better coordination.

## 1. Box/Search Jumpscares

### System: `BoxScareManager`

**Location**: `src/core/boxScares.ts`

**Purpose**: Trigger scares when opening containers, separate from mimics and loot

### Box Scare Types (8 total)

1. **lid_slam** - Container lid slams shut briefly (moderate)
2. **hand_inside** - Brief hand/face appears inside box (major)
3. **object_falls** - Nearby object shakes and moves (subtle)
4. **whisper** - Subtle whisper text "...behind you..." (subtle)
5. **screen_glitch** - Brief screen distortion (moderate)
6. **false_mimic** - Box shows teeth then returns to normal (major)
7. **wall_shift** - Nearby wall seems to shift (moderate)
8. **shadow_figure** - Dark figure briefly visible near box (major)

### Trigger Probabilities

| Floor | Base Chance | With Key |
|-------|-------------|----------|
| Floor 4 | 6.5% | 8.5% |
| Floor 3 | 10% | 13% |
| Floor 2 | 15% | 19.5% |
| Floor 1 | 20% | 26% |
| Block 13 | 28% | 36.4% |

### Key Features

- **Deterministic**: 4-6 scares selected per run
- **No repetition**: Won't repeat same scare consecutively
- **Global cooldown**: 12 seconds between box scares
- **Loot preserved**: Scares don't affect actual rewards
- **Delays**: Some scares trigger 0-300ms after opening (during search animation)

### Integration

Box scares trigger in `interactWithSearchable()`:
1. Player opens container
2. Box scare check (if applicable, doesn't replace mimic)
3. Normal jumpscare check (existing system)
4. Loot reward (always happens)
5. Ambusher check (if nearby)

**Important**: Box scares are **in addition to** loot, not instead of. A box can scare AND contain battery/health/collectibles.

## 2. Hidden Enemy / Ambusher

### System: `Ambusher` class

**Location**: `src/core/ambusher.ts`

**Purpose**: Create paranoia about corners, dark rooms, and previously explored areas

### Behavior States

1. **hidden** - Invisible, waiting for trigger
2. **warning** - Subtle visibility (0.2-0.5 alpha), 800ms warning
3. **revealing** - Fully visible, preparing to rush (1200ms)
4. **rushing** - Moving toward player (1500ms, 140 speed)
5. **retreating** - Moving away after contact/timeout (2000ms, 180 speed)
6. **inactive** - No longer active this floor

### Spawn Counts

| Floor | Count | Locations |
|-------|-------|-----------|
| Floor 4 | 0-1 | Tutorial, very rare |
| Floor 3 | 1 | Single ambush point |
| Floor 2 | 1-2 | Multiple hiding spots |
| Floor 1 | 2 | Frequent ambushes |
| Block 13 | 2-3 | Maximum paranoia |

### Damage & Effects

- **HP Damage**: 7-8 HP per contact
- **Curse**: +8-10 curse per contact
- **Contact range**: 30 pixels
- **Safe zones**: Never spawn on mandatory paths or too close to player

### Trigger Conditions

Ambushers reveal when:
- Player enters detection range (120 pixels)
- Player searches container within 150 pixels (40% chance)
- Player approaches from dark areas
- Post-key escalation (increased sensitivity)

**Blocked during**:
- Story popups
- Floor transitions
- Pause menu
- Other major scares active
- Victory/death sequences

### Visual Tells (Observable by Careful Players)

- **Amber glowing eyes** (subtle when hidden)
- **Alpha pulse** between 0.2-0.5 during warning
- **Position near walls** (hiding spots)
- **Hunched darker figure** compared to other enemies

## 3. Scare Coordination System

### Problem Solved

Prevents overlapping major scares creating jarring experience:
- Box scare + ambusher + false stalker + moving wall all at once

### Solution: `activeMajorScare` Flag

**Location**: Updated `JumpscareDirector` in `jumpscares.ts`

#### Major Scare Events
- Box scares (intensity: major)
- Ambusher reveals/rushes
- False stalker appearances
- Major environmental scares

#### Coordination Rules

1. **Only one major scare active at a time**
2. **Subtle scares can overlap** (ambient effects)
3. **Moderate scares respect major scare cooldown**
4. **Ambushers won't trigger during major scares**
5. **Box scares temporarily block other major events**

#### Implementation

```typescript
// Check before triggering
if (this.jumpscareDirector.isMajorScareActive()) {
  return; // Don't trigger new major scare
}

// Set when major scare starts
this.jumpscareDirector.setMajorScareActive(true);

// Clear when scare ends
this.time.delayedCall(duration, () => {
  this.jumpscareDirector.setMajorScareActive(false);
});
```

## 4. Horror Psychology

### Design Goals

**Searching should feel like**:
> "I need the loot... but opening this could be a terrible idea."

**Hidden enemies create distrust of**:
- Corners and dark alcoves
- Rooms already visited
- Areas near containers
- Routes back through explored territory

### Pacing Strategy

- **Not jumpscare spam** - Cooldowns prevent constant triggers
- **Variety** - 8 box scares + existing scares = rich mix
- **Escalation** - Rates increase floor-by-floor
- **Unpredictability** - Seeded but feels random
- **Risk/reward** - More searches = more scares + more loot

### Key Preservation

All scares increase after getting key:
- **Box scares**: +30% chance
- **Environmental scares**: +30-100% chance
- **Ambushers**: More sensitive to player
- **Stalker**: More aggressive

This creates escalating tension in second half of each floor.

## 5. Technical Implementation

### New Files Created

1. **`src/core/boxScares.ts`** - Box scare manager (145 lines)
2. **`src/core/ambusher.ts`** - Ambusher class + spawning (271 lines)

### Modified Files

1. **`src/core/jumpscares.ts`**
   - Added `activeMajorScare` flag
   - Added `setMajorScareActive()` and `isMajorScareActive()` methods
   - Updated `canTriggerScare()` to respect major scare state

2. **`src/game/scenes/FloorScene.ts`**
   - Added `boxScareManager`, `ambushers[]`, `ambusherSprites[]`
   - Created `createAmbusherSprites()` method
   - Created `updateAmbushers()` method  
   - Created `executeBoxScare()` method with 8 scare implementations
   - Updated `interactWithSearchable()` to trigger box scares
   - Updated `shutdown()` to clean up ambushers
   - Added ambusher update to main loop

### Performance Impact

**Bundle size**: 1,730 kB (was 1,721 kB)
- **+9 kB** for new systems
- **Negligible impact** on gameplay

**Runtime**:
- Box scare checks: O(1) per search
- Ambusher updates: O(n) where n = 0-3 per floor
- No significant performance degradation

## 6. Testing Checklist

### Box Scares

- [x] Scares trigger at correct rates per floor
- [x] Scares don't repeat consecutively
- [x] Loot rewards still given after scare
- [x] Cooldown prevents spam
- [x] All 8 scare types implemented
- [x] Visual effects don't break UI
- [x] No overlap with mimics (both can exist)

### Ambushers

- [x] Spawn at correct floor counts
- [x] Hidden state is truly invisible
- [x] Warning gives ~800ms reaction time
- [x] Rushing doesn't chase entire floor
- [x] Damage/curse applied on contact only
- [x] Respects invulnerability system
- [x] Retreats after timeout
- [x] Never blocks mandatory paths

### Coordination

- [x] Major scares don't overlap
- [x] Subtle scares can still trigger
- [x] Transitions block all scares
- [x] Story popups block scares
- [x] Pause blocks scares
- [x] Flag clears properly after scare ends

## 7. Balance Analysis

### Search Risk Profile

**Floor 4** (Tutorial):
- 6.5% box scare chance
- 0-1 ambushers
- Still relatively safe to learn

**Floor 3** (Introduction):
- 10% box scare chance
- 1 ambusher
- Occasional surprises

**Floor 2** (Pressure):
- 15% box scare chance
- 1-2 ambushers
- Noticeable tension

**Floor 1** (High Danger):
- 20% box scare chance
- 2 ambushers
- High risk searching

**Block 13** (Finale):
- 28% box scare chance
- 2-3 ambushers
- Maximum paranoia

### Expected Experience

**Typical Floor 2 Run** (~25 searchable containers):
- **Expected box scares**: ~3-4 triggered
- **Expected ambush encounters**: 1-2 reveals
- **Mimic encounters**: 1 (separate system)
- **Normal jumpscares**: 2-3 (existing system)

**Total scare events per floor**: 7-10 (appropriate pacing)

### Player Counterplay

**Box Scares**:
- Can't avoid if searching
- Accept risk for reward
- Plan searches when safe (no stalker nearby)

**Ambushers**:
- Watch for amber eyes during warning phase
- Keep moving when exploring
- Use flashlight in dark corners
- Don't linger in one area

## 8. Future Enhancements (Optional)

### Potential Additions

1. **Ambusher variants**
   - Different hiding behaviors
   - Varied visual designs
   - Special ambush types per floor

2. **Box scare variations**
   - Specific scares for specific containers
   - Cabinet vs locker vs box differences
   - Rare "mega scares" on Block 13

3. **Audio integration**
   - Whisper sound effects
   - Breathing in warning phase
   - Slam/crash sounds
   - Ambient creaking near ambushers

4. **Advanced coordination**
   - Ambusher + stalker combos
   - Box scare alerts nearby ambusher
   - Corruption effects enhance scares

### Not Recommended

- ❌ More ambushers (3+ would be too many)
- ❌ Higher box scare rates (>30% is too frequent)
- ❌ Ambushers that chase across floor (ruins tension)
- ❌ Unavoidable scare sequences (player needs agency)

## 9. Commit Summary

**Added**:
- Box scare system with 8 authored scare types
- Ambusher enemy class with 5-state behavior
- Major scare coordination to prevent overlap
- Integration with search interaction flow
- Proper cleanup in shutdown()

**Preserved**:
- All existing jumpscare systems
- Mimic system (separate from box scares)
- Stalker behavior
- Loot balance
- Combat fairness
- State persistence

**Build**: Successful  
**Bundle**: 1,730 kB (+9 kB)  
**Status**: Ready for playtesting

---

## Quick Reference

### Box Scare Rates
```
Floor 4: 6.5%  → 8.5% (with key)
Floor 3: 10%   → 13%
Floor 2: 15%   → 19.5%
Floor 1: 20%   → 26%
Block 13: 28%  → 36.4%
```

### Ambusher Counts
```
Floor 4: 0-1
Floor 3: 1
Floor 2: 1-2
Floor 1: 2
Block 13: 2-3
```

### Damage Summary
```
Box scares: 0 HP (pure horror)
Ambusher contact: 7-8 HP + 8-10 curse
Cooldowns: 12s box, 15s major scare
```
