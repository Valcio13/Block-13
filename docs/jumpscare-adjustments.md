# Jumpscare System Adjustments - Playtesting Update

## Overview

Adjusted Ambusher and box scare implementation based on playtesting goals. Ambusher is now a proper jumpscare (not combat enemy), and scare frequency has been audited and clarified.

## 1. Ambusher Redesign

### OLD Behavior (Combat Enemy)
```
Hidden → Warning (800ms) → Revealing (1200ms) → Rushing (1500ms) → Retreating → Inactive
- Chases player across room
- 7-8 HP + 8-10 curse damage
- Multiple states with movement
- Could trigger repeatedly
```

### NEW Behavior (Jumpscare)
```
Hidden → Warning (150-400ms, subtle) → FACE CLOSE-UP JUMPSCARE → Inactive
- One-time trigger only
- 5-8 HP damage (NO curse)
- Disappears after jumpscare
- Primary payoff is scare, not combat
```

### Sequence Breakdown

**1. Hidden State**
- Invisible world sprite near walls/corners
- Detection range: 120 pixels
- Also triggers from nearby container searches (40% chance within 150px)

**2. Warning Phase**
- **Duration**: 150-400ms (randomized per ambusher)
- **Visibility**: 0.15-0.25 alpha (very subtle)
- **Visual tells**:
  - Amber glowing eyes barely visible
  - Slight shadow movement
  - Dark hunched figure outline
  - NO warning message to player

**3. Face Close-Up Jumpscare**
- **Face sprite** fills center screen (400×400px)
- Dark face with glowing amber eyes
- Red mouth/teeth suggestion
- **Scream** placeholder text ("!!! SCREAM !!!")
- **Camera shake** (400ms, intensity 0.015)
- **Screen glitch** (red flash, repeats 2×)
- **Duration**: ~1000ms total (fade in 150ms, hold 650ms, fade out 200ms)

**4. Damage Application**
- Applied at 200ms into jumpscare
- **5-8 HP only** (no curse)
- Uses unified invulnerability system

**5. Cleanup**
- Ambusher becomes permanently inactive
- World sprite disappears (alpha 0)
- `hasTriggered` flag prevents re-triggering

### Asset Hooks (Future)

```typescript
// World sprite (during warning)
'ambusher_world_sprite' // 24×32, hunched dark figure with amber eyes

// Jumpscare face close-up
'ambusher_face_jumpscare' // 400×400, detailed horror face

// Audio
'ambusher_scream_audio' // Loud scream sound effect
'ambusher_breathing_audio' // Subtle breathing during warning (optional)
```

### Key Changes

| Aspect | Old | New |
|--------|-----|-----|
| Warning duration | 800ms (predictable) | 150-400ms (unpredictable) |
| Main payoff | Rush/chase combat | Face close-up jumpscare |
| Damage | 7-8 HP + 8-10 curse | 5-8 HP only |
| Trigger frequency | Could re-trigger | One-time only |
| Player counterplay | Run away from chase | Avoid detection range |

### Spawn Counts (Unchanged)

| Floor | Count | Purpose |
|-------|-------|---------|
| Floor 4 | 0-1 | Rare intro to mechanic |
| Floor 3 | 1 | Single ambush scare |
| Floor 2 | 1-2 | Increased paranoia |
| Floor 1 | 2 | Multiple hiding spots |
| Block 13 | 2-3 | Maximum tension |

## 2. Box Scare Frequency Audit

### CLARIFICATION: Implementation vs Documentation

**The Confusion**:
- Documentation claimed "4-6 box scares per RUN"
- Also claimed "3-4 box scares per FLOOR"
- This was inconsistent and confusing

**Actual Implementation** (Correct):

Box scares work on a **per-search-attempt basis**:
- Each container opened has X% chance to trigger box scare
- Chance varies by floor
- 12-second cooldown between triggers

**What "4-6 scares" Actually Means**:
- 4-6 scare **TYPES** are selected for the run (from 8 total)
- NOT the number of times they trigger
- Determines which scares are available, not frequency

### Trigger Rates Per Container

| Floor | Base % | With Key | Cooldown |
|-------|--------|----------|----------|
| Floor 4 | 6.5% | 8.5% | 12 seconds |
| Floor 3 | 10% | 13% | 12 seconds |
| Floor 2 | 15% | 19.5% | 12 seconds |
| Floor 1 | 20% | 26% | 12 seconds |
| Block 13 | 28% | 36.4% | 12 seconds |

### Expected Frequency Per Floor

Assuming ~20-25 searchable containers per floor:

**Floor 4** (~22 containers, 6.5% rate):
- **Expected**: 1-2 box scares per floor
- Very rare, mostly safe searching

**Floor 3** (~23 containers, 10% rate):
- **Expected**: 2-3 box scares per floor
- Occasional surprises

**Floor 2** (~24 containers, 15% rate):
- **Expected**: 3-4 box scares per floor
- Noticeable tension

**Floor 1** (~25 containers, 20% rate):
- **Expected**: 4-5 box scares per floor
- High risk searching

**Block 13** (~25 containers, 28% rate):
- **Expected**: 6-7 box scares per floor
- Very frequent scares

**Note**: With 12-second cooldown, maximum possible is ~8-10 per floor (limited by cooldown, not just chance).

## 3. Total Scare Frequency Per Floor

### Revised Target Pacing

**Floor 4** (Tutorial):
- 1-2 box scares
- 0-1 ambusher jumpscare
- 0 mimics
- 1-2 ambient jumpscares
- **Total: 2-4 meaningful scare events** ✅

**Floor 3** (Introduction):
- 2-3 box scares
- 1 ambusher jumpscare
- 0-1 mimic
- 1-2 ambient jumpscares
- **Total: 3-5 meaningful scare events** ✅

**Floor 2** (Pressure):
- 3-4 box scares
- 1-2 ambusher jumpscares
- 1 mimic
- 2-3 ambient jumpscares
- **Total: 4-6 meaningful scare events** ✅

**Floor 1** (High Danger):
- 4-5 box scares
- 2 ambusher jumpscares
- 1-2 mimics
- 2-3 ambient jumpscares
- **Total: 4-7 meaningful scare events** ✅

**Block 13** (Finale):
- 6-7 box scares
- 2-3 ambusher jumpscares
- 2-3 mimics
- 2-3 ambient jumpscares
- **Total: 5-8 meaningful scare events** ✅

### Scare Categories

**Major Scares** (block overlap):
- Ambusher face jumpscares
- Mimic reveals
- False stalker appearances
- Major box scares (hand_inside, false_mimic, shadow_figure)

**Moderate Scares**:
- Moderate box scares (lid_slam, screen_glitch, wall_shift)
- Door slams
- Sudden noises

**Subtle/Ambient Effects** (don't count toward totals):
- Light flickers
- Footsteps
- Whispers
- Object movements
- Shadow crosses

### Quiet Periods

**12-second cooldown** on box scares ensures spacing.

**Major scare coordination** prevents:
- Box scare + ambusher + false stalker simultaneously
- Multiple face-close-ups overlapping
- Jumpscare spam

**Expected pacing**:
- 30-60 seconds between major events
- Ambient effects can occur during quiet periods
- Stalker provides constant background tension

## 4. Damage Summary

### Updated Damage Values

**Ambusher**:
- **Old**: 7-8 HP + 8-10 curse
- **New**: 5-8 HP only (no curse)
- **Rationale**: It's a jumpscare, not a combat encounter

**Other Enemies** (Unchanged):
- Stalker: 35 HP + 30 curse
- Crawler: 15 HP
- Mimic: 15 HP (initial) + 10 HP (chase hits)
- Watcher: 0 HP (curse only, ~2/sec when close)

### Player Survivability

With new ambusher damage:
- **100 HP starting**
- Ambusher: -6 HP avg
- **Result**: Player can survive ~16 ambushers (was ~12 with curse)
- More forgiving for a jumpscare-focused enemy

## 5. Implementation Details

### Files Modified

**`src/core/ambusher.ts`**:
- Changed states: `hidden | warning | jumpscare | inactive` (removed revealing/rushing/retreating)
- Removed movement logic (moveTowardsTarget, pickRetreatTarget, etc.)
- Added `hasTriggered` flag for one-time behavior
- Warning duration randomized: 150-400ms
- Damage: 5-8 HP, removed curse
- Simplified update() to return `shouldJumpscare` only

**`src/game/scenes/FloorScene.ts`**:
- Rewrote `updateAmbushers()` for simpler logic
- Created `executeAmbusherJumpscare()` with face close-up sequence
- Removed chase/retreat handling
- World sprite only visible during warning (subtle alpha 0.15-0.25)
- Added placeholder graphics for face jumpscare

### Technical Notes

**One-time trigger**:
```typescript
if (ambusher.hasTriggered) {
  // Already triggered, keep invisible
  sprite.setAlpha(0);
  return;
}
```

**Warning unpredictability**:
```typescript
// Randomized per ambusher instance
this.warningDuration = 150 + this.rng.int(251); // 150-400ms
```

**Face jumpscare sequence**:
1. Create 400×400 face sprite with amber eyes
2. Zoom in + fade in (150ms)
3. Camera shake + screen glitch
4. Apply damage at 200ms
5. Hold for 650ms
6. Fade out (200ms)
7. Re-enable controls + clear major scare flag

## 6. Playtesting Goals Achieved

### ✅ Ambusher as Jumpscare
- Main payoff is face close-up, not combat
- One-time trigger prevents it becoming "another enemy"
- Damage reduced and curse removed
- Warning too brief to reliably avoid

### ✅ Scare Frequency Clarified
- Box scares: per-search % (not fixed count)
- Expected 2-7 per floor based on floor number
- Total scares: 2-4 (F4) to 5-8 (B13)
- Quiet periods ensured via cooldowns

### ✅ Horror Psychology Maintained
- Searching still feels risky
- Corners/dark areas still suspicious
- Warning gives just enough time to notice, not react
- Face jumpscare delivers proper "horror game" moment

## 7. Future Asset Integration

When proper assets are created, replace:

**World Sprite**:
```typescript
// Current: Generated graphics (24×32 dark rectangle with amber eyes)
// Future: `ambusher_world_sprite` sprite sheet
sprite.setTexture('ambusher_world_sprite');
```

**Face Jumpscare**:
```typescript
// Current: Generated graphics (400×400 face with eyes/mouth)
// Future: `ambusher_face_jumpscare` detailed horror art
faceSprite.setTexture('ambusher_face_jumpscare');
```

**Audio**:
```typescript
// Add when audio system implemented
this.sound.play('ambusher_scream_audio'); // During jumpscare
this.sound.play('ambusher_breathing_audio'); // During warning (optional)
```

## 8. Build Status

**Bundle**: 1,730 kB (no significant change)  
**TypeScript**: No errors  
**Build**: Successful  
**Status**: Ready for playtesting

---

## Quick Reference

### Ambusher Sequence
```
Hidden (invisible)
  ↓ Player within 120px OR searching nearby
Warning (150-400ms, subtle eyes visible)
  ↓ Timer expires
FACE CLOSE-UP JUMPSCARE (1000ms)
  ├─ Face sprite fills screen
  ├─ Camera shake + glitch
  ├─ Damage: 5-8 HP
  └─ Scream placeholder
Inactive (permanently)
```

### Box Scare Rates
```
Floor 4: 6.5%  → Expected: 1-2 per floor
Floor 3: 10%   → Expected: 2-3 per floor
Floor 2: 15%   → Expected: 3-4 per floor
Floor 1: 20%   → Expected: 4-5 per floor
Block 13: 28%  → Expected: 6-7 per floor
```

### Total Scares Per Floor
```
Floor 4: 2-4 events
Floor 3: 3-5 events
Floor 2: 4-6 events
Floor 1: 4-7 events
Block 13: 5-8 events
```

Includes: box scares + ambushers + mimics + ambient jumpscares
