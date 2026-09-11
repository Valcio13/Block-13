# Audio Asset Loading Audit

## Current Status: ❌ INCOMPLETE

### Issue Identified

**The claim that audio files can be "dropped in with no code changes" is INCORRECT.**

Phaser 3 **requires explicit preloading** of all assets. Assets placed in `public/assets/audio/` will NOT be automatically discovered or loaded.

---

## How Assets Are Currently Loaded

### Current Flow

1. **BootScene.preload()**: 
   - ❌ **NO audio loading implemented**
   - Only has placeholder TODO comment
   - Assets are never registered with Phaser's loader

2. **AudioDirector.play()**:
   - ✅ Checks if asset exists: `this.scene.cache.audio.exists(key)`
   - ✅ Gracefully handles missing assets (logs warning, returns null)
   - ❌ **Will ALWAYS fail** because assets were never loaded

3. **Result**:
   - Every audio call logs: `[AudioDirector] Missing audio asset: {key}`
   - No sounds play
   - Game continues silently

---

## Required Changes

### 1. BootScene Preload Implementation

**File**: `src/game/scenes/BootScene.ts`

**Current**:
```typescript
preload() {
  // TODO: Load actual game assets here
  // this.load.image('player', 'assets/player.png');
}
```

**Required**:
```typescript
preload() {
  // Loading UI code...
  
  // AUDIO: Load all audio assets
  this.loadAudioAssets();
}

private loadAudioAssets() {
  // Player sounds
  this.load.audio('sfx_player_footstep_1', 'assets/audio/player/sfx_player_footstep_1.ogg');
  this.load.audio('sfx_player_footstep_2', 'assets/audio/player/sfx_player_footstep_2.ogg');
  // ... etc for ALL 60+ sounds
}
```

### 2. Asset Key → File Path Mapping

**Key**: `sfx_player_hurt`  
**Path**: `assets/audio/player/sfx_player_hurt.ogg`

**Mapping Rule**:
```
Key: {category}_{subcategory}_{name}_{variant?}
Path: assets/audio/{folder}/{key}.ogg

Examples:
- sfx_player_hurt          → assets/audio/player/sfx_player_hurt.ogg
- sfx_ambusher_scream      → assets/audio/enemies/ambusher/sfx_ambusher_scream.ogg
- amb_environment_creak_1  → assets/audio/environment/amb_environment_creak_1.ogg
```

### 3. Variant Loading

**AudioDirector.playVariant()** expects:
```typescript
playVariant('sfx_player_footstep', 4, 'sfx')
```

**Requires preloading**:
- `sfx_player_footstep_1`
- `sfx_player_footstep_2`
- `sfx_player_footstep_3`
- `sfx_player_footstep_4`

Each variant must be explicitly loaded in BootScene.

### 4. Missing Asset Fallback

**Current**: ✅ Working correctly
- Checks `scene.cache.audio.exists(key)` before playing
- Logs warning if missing
- Returns null, gameplay continues

**After preload implemented**:
- If file doesn't exist on server → Phaser load will fail (404)
- If file exists but not preloaded → AudioDirector catches it
- Both scenarios handled gracefully

---

## Exact Required Filenames (Priority 10)

### Priority 1-10 (Already Connected)

| Priority | Key | Exact Filename | Path |
|----------|-----|----------------|------|
| 1 | `sfx_ambusher_scream` | `sfx_ambusher_scream.ogg` | `assets/audio/enemies/ambusher/` |
| 2 | `sfx_ambusher_impact` | `sfx_ambusher_impact.ogg` | `assets/audio/enemies/ambusher/` |
| 3 | `sfx_player_hurt` | `sfx_player_hurt.ogg` | `assets/audio/player/` |
| 4 | `sfx_interaction_container_open` | `sfx_interaction_container_open.ogg` | `assets/audio/interactions/` |
| 5 | `sfx_interaction_key_pickup` | `sfx_interaction_key_pickup.ogg` | `assets/audio/interactions/` |
| 6 | `sfx_progression_key_found` | `sfx_progression_key_found.ogg` | `assets/audio/progression/` |
| 7 | `sfx_interaction_locked` | `sfx_interaction_locked.ogg` | `assets/audio/interactions/` |
| 8 | `sfx_interaction_unlock` | `sfx_interaction_unlock.ogg` | `assets/audio/interactions/` |
| 9 | `sfx_interaction_floor_transition` | `sfx_interaction_floor_transition.ogg` | `assets/audio/interactions/` |
| 10 | `sfx_jumpscare_lid_slam` | `sfx_jumpscare_lid_slam.ogg` | `assets/audio/jumpscares/` |

### Box Scare Stingers (Connected)

| Key | Exact Filename | Path |
|-----|----------------|------|
| `sfx_jumpscare_hand_inside` | `sfx_jumpscare_hand_inside.ogg` | `assets/audio/jumpscares/` |
| `sfx_jumpscare_object_falls` | `sfx_jumpscare_object_falls.ogg` | `assets/audio/jumpscares/` |
| `sfx_jumpscare_whisper` | `sfx_jumpscare_whisper.ogg` | `assets/audio/jumpscares/` |
| `sfx_jumpscare_screen_glitch` | `sfx_jumpscare_screen_glitch.ogg` | `assets/audio/jumpscares/` |
| `sfx_jumpscare_false_mimic` | `sfx_jumpscare_false_mimic.ogg` | `assets/audio/jumpscares/` |
| `sfx_jumpscare_wall_shift` | `sfx_jumpscare_wall_shift.ogg` | `assets/audio/jumpscares/` |
| `sfx_jumpscare_shadow_figure` | `sfx_jumpscare_shadow_figure.ogg` | `assets/audio/jumpscares/` |

---

## Complete Preload Requirements

### All Audio Assets That Need Preloading

**Total**: 60+ audio files across 12 directories

#### Player (7 files)
```
assets/audio/player/
├── sfx_player_footstep_1.ogg
├── sfx_player_footstep_2.ogg
├── sfx_player_footstep_3.ogg
├── sfx_player_footstep_4.ogg
├── sfx_player_footstep_sprint.ogg
├── sfx_player_hurt.ogg
└── sfx_player_breathing_low.ogg
```

#### Interactions (5 files)
```
assets/audio/interactions/
├── sfx_interaction_container_open.ogg
├── sfx_interaction_key_pickup.ogg
├── sfx_interaction_locked.ogg
├── sfx_interaction_unlock.ogg
└── sfx_interaction_floor_transition.ogg
```

#### Flashlight (4 files)
```
assets/audio/flashlight/
├── sfx_flashlight_on.ogg
├── sfx_flashlight_off.ogg
├── sfx_flashlight_flicker.ogg
└── sfx_flashlight_depleted.ogg
```

#### Environment (7 files)
```
assets/audio/environment/
├── amb_environment_fluorescent_hum.ogg
├── amb_environment_creak_1.ogg
├── amb_environment_creak_2.ogg
├── amb_environment_creak_3.ogg
├── amb_environment_distant_impact.ogg
├── amb_environment_dripping_water.ogg
└── sfx_environment_moving_wall.ogg
```

#### Enemies - Stalker (6 files)
```
assets/audio/enemies/stalker/
├── sfx_stalker_distant_movement.ogg
├── sfx_stalker_footsteps.ogg
├── sfx_stalker_breathing.ogg
├── sfx_stalker_detected.ogg
├── sfx_stalker_chase.ogg
└── sfx_stalker_attack.ogg
```

#### Enemies - Crawler (3 files)
```
assets/audio/enemies/crawler/
├── sfx_crawler_movement.ogg
├── sfx_crawler_detection.ogg
└── sfx_crawler_attack.ogg
```

#### Enemies - Watcher (2 files)
```
assets/audio/enemies/watcher/
├── amb_watcher_presence.ogg
└── sfx_watcher_disappear.ogg
```

#### Enemies - Mimic (3 files)
```
assets/audio/enemies/mimic/
├── sfx_mimic_tell.ogg
├── sfx_mimic_reveal.ogg
└── sfx_mimic_attack.ogg
```

#### Enemies - Ambusher (3 files)
```
assets/audio/enemies/ambusher/
├── sfx_ambusher_pre_scare.ogg
├── sfx_ambusher_scream.ogg
└── sfx_ambusher_impact.ogg
```

#### Jumpscares (12 files)
```
assets/audio/jumpscares/
├── sfx_jumpscare_lid_slam.ogg
├── sfx_jumpscare_hand_inside.ogg
├── sfx_jumpscare_object_falls.ogg
├── sfx_jumpscare_whisper.ogg
├── sfx_jumpscare_screen_glitch.ogg
├── sfx_jumpscare_false_mimic.ogg
├── sfx_jumpscare_wall_shift.ogg
├── sfx_jumpscare_shadow_figure.ogg
├── sfx_jumpscare_door_slam.ogg
├── sfx_jumpscare_footsteps.ogg
├── sfx_jumpscare_false_stalker.ogg
└── sfx_jumpscare_sudden_noise.ogg
```

#### Progression (4 files)
```
assets/audio/progression/
├── sfx_progression_key_found.ogg
├── sfx_progression_block13_reveal.ogg
├── sfx_progression_objective_complete.ogg
└── sfx_progression_victory.ogg
```

#### Ambience (3 files)
```
assets/audio/ambience/
├── amb_floor_general.ogg
├── amb_floor_deep.ogg
└── amb_block13.ogg
```

#### Music (2 files) - Optional
```
assets/audio/music/
├── music_main_theme.ogg
└── music_chase_theme.ogg
```

**Total**: 61 audio files

---

## Implementation Strategy

### Option 1: Manual Preload (Most Common)

**Pros**: Full control, explicit, clear
**Cons**: Every new audio file requires code change

```typescript
// BootScene.ts
private loadAudioAssets() {
  // Player
  for (let i = 1; i <= 4; i++) {
    this.load.audio(`sfx_player_footstep_${i}`, `assets/audio/player/sfx_player_footstep_${i}.ogg`);
  }
  this.load.audio('sfx_player_hurt', 'assets/audio/player/sfx_player_hurt.ogg');
  
  // Interactions
  this.load.audio('sfx_interaction_container_open', 'assets/audio/interactions/sfx_interaction_container_open.ogg');
  // ... 57 more lines
}
```

### Option 2: Array-Based Bulk Load (Recommended)

**Pros**: Cleaner, easier to maintain
**Cons**: Still requires updating array when adding sounds

```typescript
// BootScene.ts
private loadAudioAssets() {
  const audioAssets = [
    // Player
    { key: 'sfx_player_footstep_1', path: 'assets/audio/player/sfx_player_footstep_1.ogg' },
    { key: 'sfx_player_footstep_2', path: 'assets/audio/player/sfx_player_footstep_2.ogg' },
    { key: 'sfx_player_hurt', path: 'assets/audio/player/sfx_player_hurt.ogg' },
    // ... etc
  ];
  
  audioAssets.forEach(asset => {
    this.load.audio(asset.key, asset.path);
  });
}
```

### Option 3: Import AUDIO_KEYS (Best)

**Pros**: Single source of truth, DRY
**Cons**: Requires path derivation logic

```typescript
// BootScene.ts
import { AUDIO_KEYS } from '../../core/audioDirector';

private loadAudioAssets() {
  // Helper to derive path from key
  const getPath = (key: string): string => {
    if (key.startsWith('sfx_player_')) return `assets/audio/player/${key}.ogg`;
    if (key.startsWith('sfx_interaction_')) return `assets/audio/interactions/${key}.ogg`;
    if (key.startsWith('sfx_stalker_')) return `assets/audio/enemies/stalker/${key}.ogg`;
    // ... etc
    return `assets/audio/${key}.ogg`; // fallback
  };
  
  // Flatten AUDIO_KEYS and load each
  Object.values(AUDIO_KEYS).forEach(category => {
    Object.values(category).forEach((value) => {
      if (typeof value === 'string') {
        this.load.audio(value, getPath(value));
      }
    });
  });
}
```

---

## Answer to Original Questions

### 1. How assets are currently loaded

**Answer**: They are NOT loaded. BootScene has no audio preloading implemented.

### 2. Is "drop-in with no code changes" accurate?

**Answer**: ❌ **NO**. This is incorrect.

**Reality**:
1. Add audio file to `public/assets/audio/`
2. Add `this.load.audio(key, path)` to BootScene.preload()
3. Audio will then work

**"No code changes" is FALSE** - every new audio file requires a preload line.

### 3. Exact required filenames for first 10 priority sounds

See table above. All files must be `.ogg` format and match key exactly.

### 4. Preload changes needed

**Required**: Implement complete audio preloading in BootScene.

**Minimum for testing** (Priority 10):
```typescript
// BootScene.ts preload()
this.load.audio('sfx_ambusher_scream', 'assets/audio/enemies/ambusher/sfx_ambusher_scream.ogg');
this.load.audio('sfx_ambusher_impact', 'assets/audio/enemies/ambusher/sfx_ambusher_impact.ogg');
this.load.audio('sfx_player_hurt', 'assets/audio/player/sfx_player_hurt.ogg');
this.load.audio('sfx_interaction_container_open', 'assets/audio/interactions/sfx_interaction_container_open.ogg');
this.load.audio('sfx_interaction_key_pickup', 'assets/audio/interactions/sfx_interaction_key_pickup.ogg');
this.load.audio('sfx_progression_key_found', 'assets/audio/progression/sfx_progression_key_found.ogg');
this.load.audio('sfx_interaction_locked', 'assets/audio/interactions/sfx_interaction_locked.ogg');
this.load.audio('sfx_interaction_unlock', 'assets/audio/interactions/sfx_interaction_unlock.ogg');
this.load.audio('sfx_interaction_floor_transition', 'assets/audio/interactions/sfx_interaction_floor_transition.ogg');
this.load.audio('sfx_jumpscare_lid_slam', 'assets/audio/jumpscares/sfx_jumpscare_lid_slam.ogg');
```

---

## Recommendations

### Immediate Action Required

1. ✅ **Implement audio preloading in BootScene** (Option 3 recommended)
2. ✅ **Update documentation** to clarify preload requirement
3. ✅ **Add helper function** to derive paths from keys
4. ⚠️ **Test with one real audio file** to verify flow

### Documentation Corrections

**`docs/audio-system.md`** - Update section:

**OLD** (Incorrect):
> "The foundation is complete and tested. Audio assets can now be added incrementally without code changes."

**NEW** (Correct):
> "The foundation is complete and tested. Audio assets require two steps:
> 1. Place file in `public/assets/audio/{category}/`
> 2. Add preload line to `BootScene.ts` (or use bulk loading helper)
> 
> Once preloaded, assets work automatically via AudioDirector."

---

## Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| AudioDirector | ✅ Complete | Handles playback, positioning, settings |
| Asset discovery | ❌ Not implemented | Phaser requires explicit preload |
| Graceful fallback | ✅ Working | Missing assets don't crash game |
| "Drop-in" claim | ❌ FALSE | Preload code required for each asset |
| Path mapping | ⚠️ Needs implementation | No helper function yet |
| Variant loading | ⚠️ Needs explicit preload | Each variant must be loaded separately |

**Verdict**: Audio system architecture is solid, but **preloading infrastructure is missing**. This must be implemented before any audio files will work.

---

**Next Steps**:
1. Implement BootScene.preload() audio loading
2. Add bulk loading helper
3. Test with 1-2 real audio files
4. Update documentation to clarify workflow
