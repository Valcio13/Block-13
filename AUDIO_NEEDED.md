# Block 13 - Audio Assets Needed

Complete list of all audio files required for Block 13, organized by priority.

**Total**: 61 audio files  
**Format**: OGG or MP3 (OGG recommended)  
**Sample Rate**: 44.1kHz or 48kHz  
**Status**: All missing - system ready, awaiting assets  

---

## Priority 1: CRITICAL (Already Connected, High Impact)

These sounds are already hooked up and will play immediately when added.

### Ambusher (2 files) - HIGHEST PRIORITY
**Impact**: Main jumpscare mechanic

| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| `sfx_ambusher_scream.ogg` | Jumpscare scream | 0.5-1s | **LOUD**, sudden, terrifying |
| `sfx_ambusher_impact.ogg` | Hit/damage impact | 0.2-0.4s | Heavy thud, body hit |

**Path**: `assets/audio/enemies/ambusher/`

### Player Core (1 file)
| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| `sfx_player_hurt.ogg` | Player takes damage | 0.3-0.5s | Pain sound, grunt |

**Path**: `assets/audio/player/`

### Interactions (5 files)
| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| `sfx_interaction_container_open.ogg` | Open box/container | 0.4-0.6s | Creak, wood/metal open |
| `sfx_interaction_key_pickup.ogg` | Pick up key | 0.3-0.5s | Metallic jingle, grab |
| `sfx_interaction_locked.ogg` | Try locked door | 0.4-0.6s | Rattle, reject sound |
| `sfx_interaction_unlock.ogg` | Unlock stairs | 0.6-0.8s | Lock mechanism, success |
| `sfx_interaction_floor_transition.ogg` | Descend stairs | 1-2s | Footsteps on stairs, echo |

**Path**: `assets/audio/interactions/`

### Progression (1 file)
| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| `sfx_progression_key_found.ogg` | Key collected milestone | 0.5-0.8s | Success chime, relief |

**Path**: `assets/audio/progression/`

**Priority 1 Total: 10 files**

---

## Priority 2: BOX SCARES (Already Connected)

All 8 box scare types are connected and will trigger during container searches.

| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| `sfx_jumpscare_lid_slam.ogg` | Lid slams shut | 0.3-0.5s | Sudden bang, wood/metal |
| `sfx_jumpscare_hand_inside.ogg` | Hand/face in box | 0.4-0.7s | Gasp, sudden movement |
| `sfx_jumpscare_object_falls.ogg` | Object falls nearby | 0.5-1s | Crash, thud, scatter |
| `sfx_jumpscare_whisper.ogg` | Whisper behind player | 1-2s | Close, unintelligible |
| `sfx_jumpscare_screen_glitch.ogg` | Screen distortion | 0.3-0.5s | Digital glitch, static |
| `sfx_jumpscare_false_mimic.ogg` | False mimic lunge | 0.4-0.6s | Container burst, teeth |
| `sfx_jumpscare_wall_shift.ogg` | Wall moves/shifts | 0.6-1s | Grinding stone, scrape |
| `sfx_jumpscare_shadow_figure.ogg` | Shadow appears | 0.4-0.7s | Whoosh, echo, unnatural |

**Path**: `assets/audio/jumpscares/`

**Priority 2 Total: 8 files**

---

## Priority 3: PLAYER FEEDBACK (Hooks Ready)

Essential for player immersion and feedback.

### Player Movement (5 files)
| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| `sfx_player_footstep_1.ogg` | Footstep variant 1 | 0.2-0.3s | Concrete, subtle variation |
| `sfx_player_footstep_2.ogg` | Footstep variant 2 | 0.2-0.3s | Concrete, subtle variation |
| `sfx_player_footstep_3.ogg` | Footstep variant 3 | 0.2-0.3s | Concrete, subtle variation |
| `sfx_player_footstep_4.ogg` | Footstep variant 4 | 0.2-0.3s | Concrete, subtle variation |
| `sfx_player_footstep_sprint.ogg` | Sprint footstep | 0.15-0.25s | Faster, heavier, urgent |

**Path**: `assets/audio/player/`

### Player Status (1 file)
| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| `sfx_player_breathing_low.ogg` | Low health breathing | 2-3s loop | Heavy, labored, **LOOPABLE** |

**Path**: `assets/audio/player/`

### Flashlight (4 files)
| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| `sfx_flashlight_on.ogg` | Toggle on | 0.2-0.3s | Click, buzz startup |
| `sfx_flashlight_off.ogg` | Toggle off | 0.2-0.3s | Click, fade out |
| `sfx_flashlight_flicker.ogg` | Low battery | 0.3-0.5s | Electrical sputter |
| `sfx_flashlight_depleted.ogg` | Battery empty | 0.4-0.6s | Dying buzz, fade |

**Path**: `assets/audio/flashlight/`

**Priority 3 Total: 10 files**

---

## Priority 4: STALKER (Hooks Ready, Positional)

Main enemy audio - critical for tension.

| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| `sfx_stalker_footsteps.ogg` | Stalker walking | 0.4-0.6s | Heavy, slow, ominous |
| `sfx_stalker_breathing.ogg` | Nearby breathing | 1-2s loop | Deep, rasping, **LOOPABLE** |
| `sfx_stalker_distant_movement.ogg` | Far off sounds | 0.5-1s | Faint footsteps, echo |
| `sfx_stalker_detected.ogg` | Player spotted | 0.5-0.8s | Alert stinger, tension |
| `sfx_stalker_chase.ogg` | Chase music/sound | 1-2s loop | Fast footsteps, **LOOPABLE** |
| `sfx_stalker_attack.ogg` | Attack hit | 0.4-0.6s | Impact, scream, brutal |

**Path**: `assets/audio/enemies/stalker/`

**Priority 4 Total: 6 files**

---

## Priority 5: ENVIRONMENT & AMBIENCE

Creates atmosphere and world feel.

### Environment Effects (7 files)
| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| `amb_environment_fluorescent_hum.ogg` | Light hum | 3-5s loop | Low drone, **LOOPABLE** |
| `amb_environment_creak_1.ogg` | Building creak 1 | 1-2s | Wood/metal stress |
| `amb_environment_creak_2.ogg` | Building creak 2 | 1-2s | Variation |
| `amb_environment_creak_3.ogg` | Building creak 3 | 1-2s | Variation |
| `amb_environment_distant_impact.ogg` | Distant bang | 0.5-1s | Far-off crash, echo |
| `amb_environment_dripping_water.ogg` | Water drips | 2-3s loop | Slow drips, **LOOPABLE** |
| `sfx_environment_moving_wall.ogg` | Wall moves | 1-2s | Grinding, mechanical |

**Path**: `assets/audio/environment/`

### Ambient Loops (3 files)
| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| `amb_floor_general.ogg` | General floor ambience | 30-60s | Subtle dread, **LOOPABLE** |
| `amb_floor_deep.ogg` | Deep floor ambience | 30-60s | Darker, heavier, **LOOPABLE** |
| `amb_block13.ogg` | Block 13 ambience | 30-60s | Most ominous, **LOOPABLE** |

**Path**: `assets/audio/ambience/`

**Priority 5 Total: 10 files**

---

## Priority 6: SECONDARY ENEMIES (Hooks Ready, Positional)

### Crawler (3 files)
| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| `sfx_crawler_movement.ogg` | Skittering sound | 0.5-1s | Nails on floor, insect-like |
| `sfx_crawler_detection.ogg` | Spots player | 0.3-0.5s | Hiss, chittering |
| `sfx_crawler_attack.ogg` | Lunge attack | 0.4-0.6s | Quick strike, teeth |

**Path**: `assets/audio/enemies/crawler/`

### Watcher (2 files)
| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| `amb_watcher_presence.ogg` | Presence drone | 2-3s loop | Unsettling hum, **LOOPABLE** |
| `sfx_watcher_disappear.ogg` | Teleport/vanish | 0.4-0.6s | Whoosh, distortion |

**Path**: `assets/audio/enemies/watcher/`

### Mimic (3 files)
| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| `sfx_mimic_tell.ogg` | Subtle tell | 0.3-0.5s | Faint breathing, creak |
| `sfx_mimic_reveal.ogg` | Transforms | 0.6-0.9s | Container bursts, horror |
| `sfx_mimic_attack.ogg` | Attacks | 0.4-0.6s | Teeth snap, lunge |

**Path**: `assets/audio/enemies/mimic/`

### Ambusher (1 more file)
| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| `sfx_ambusher_pre_scare.ogg` | Pre-jumpscare cue | 0.2-0.4s | Faint breathing, warning |

**Path**: `assets/audio/enemies/ambusher/`

**Priority 6 Total: 9 files**

---

## Priority 7: ADDITIONAL JUMPSCARES (Hooks Ready)

4 more jumpscare types for variety.

| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| `sfx_jumpscare_door_slam.ogg` | Door slams | 0.4-0.6s | Heavy slam, echo |
| `sfx_jumpscare_footsteps.ogg` | Sudden running | 1-2s | Fast footsteps, panic |
| `sfx_jumpscare_false_stalker.ogg` | False stalker | 0.5-0.8s | Heavy breathing, step |
| `sfx_jumpscare_sudden_noise.ogg` | Generic loud noise | 0.3-0.5s | Bang, crash, sharp |

**Path**: `assets/audio/jumpscares/`

**Priority 7 Total: 4 files**

---

## Priority 8: PROGRESSION & MILESTONES (Hooks Ready)

| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| `sfx_progression_block13_reveal.ogg` | Enter Block 13 | 1-2s | Ominous stinger, dread |
| `sfx_progression_objective_complete.ogg` | Floor cleared | 0.6-0.9s | Minor success chime |
| `sfx_progression_victory.ogg` | Escape complete | 2-3s | Victory fanfare, relief |

**Path**: `assets/audio/progression/`

**Priority 8 Total: 3 files**

---

## Priority 9: MUSIC (Optional)

Music is entirely optional. Game works great with just ambience and SFX.

| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| `music_main_theme.ogg` | Main menu theme | 60-120s | Dark, atmospheric, **LOOPABLE** |
| `music_chase_theme.ogg` | Chase music | 30-60s | Tense, urgent, **LOOPABLE** |

**Path**: `assets/audio/music/`

**Priority 9 Total: 2 files**

---

## Summary by Priority

| Priority | Category | Files | Status | Impact |
|----------|----------|-------|--------|--------|
| 1 | Critical (connected) | 10 | ✅ Hooks ready | HIGHEST - Core gameplay |
| 2 | Box scares (connected) | 8 | ✅ Hooks ready | HIGH - Variety, tension |
| 3 | Player feedback | 10 | ✅ Hooks ready | HIGH - Immersion |
| 4 | Stalker | 6 | ✅ Hooks ready | HIGH - Main enemy |
| 5 | Environment/ambience | 10 | ✅ Hooks ready | MEDIUM - Atmosphere |
| 6 | Secondary enemies | 9 | ✅ Hooks ready | MEDIUM - Variety |
| 7 | Extra jumpscares | 4 | ✅ Hooks ready | LOW - Extra polish |
| 8 | Progression | 3 | ✅ Hooks ready | LOW - Milestones |
| 9 | Music | 2 | ✅ Hooks ready | OPTIONAL |

**Total**: 61 files (59 essential, 2 optional)

---

## Quick Start Guide

### To Add First 10 Sounds (Immediate Impact)

1. **Ambusher scream** - `assets/audio/enemies/ambusher/sfx_ambusher_scream.ogg`
2. **Ambusher impact** - `assets/audio/enemies/ambusher/sfx_ambusher_impact.ogg`
3. **Player hurt** - `assets/audio/player/sfx_player_hurt.ogg`
4. **Container open** - `assets/audio/interactions/sfx_interaction_container_open.ogg`
5. **Key pickup** - `assets/audio/interactions/sfx_interaction_key_pickup.ogg`
6. **Key found** - `assets/audio/progression/sfx_progression_key_found.ogg`
7. **Locked door** - `assets/audio/interactions/sfx_interaction_locked.ogg`
8. **Unlock** - `assets/audio/interactions/sfx_interaction_unlock.ogg`
9. **Floor transition** - `assets/audio/interactions/sfx_interaction_floor_transition.ogg`
10. **Lid slam** - `assets/audio/jumpscares/sfx_jumpscare_lid_slam.ogg`

These 10 files will cover:
- Main jumpscare
- Player damage feedback
- All core interactions
- 1 box scare variant

---

## Audio Design Guidelines

### General

- **Format**: OGG preferred (better compression, universal browser support)
- **Sample Rate**: 44.1kHz (standard) or 48kHz (higher quality)
- **Bit Rate**: 128kbps (SFX), 192kbps+ (music/long ambience)
- **Channels**: Mono for most SFX, stereo for ambience/music

### Volume Levels (Pre-Master)

- **SFX**: Normalize to -3dB to -6dB peak
- **Ambience**: -12dB to -18dB (quieter, background)
- **Music**: -9dB to -12dB (balanced)
- **Jumpscares**: -3dB (louder for impact, but not clipping)

### Horror-Specific

**Do**:
- Use silence strategically (don't fill every moment)
- Layer textures for depth (reverb, lo-fi processing)
- Keep enemy sounds informative but not too precise
- Make jumpscares punchy but not ear-damaging
- Create variations to avoid repetition

**Don't**:
- Spam constant sounds
- Make every footstep identical
- Use stock "monster roar" clichés
- Overlap too many loud scares
- Reveal exact positions through audio alone

### Loopable Sounds

These MUST loop seamlessly:
- `sfx_player_breathing_low.ogg`
- `sfx_stalker_breathing.ogg`
- `sfx_stalker_chase.ogg`
- `amb_environment_fluorescent_hum.ogg`
- `amb_environment_dripping_water.ogg`
- `amb_watcher_presence.ogg`
- `amb_floor_general.ogg`
- `amb_floor_deep.ogg`
- `amb_block13.ogg`
- `music_main_theme.ogg`
- `music_chase_theme.ogg`

Use fade in/out or crossfade techniques to ensure smooth loops.

---

## Sourcing Recommendations

### Free CC0 Sources

**Sound Effects**:
- **Freesound.org** - Massive library, filter by CC0
- **Zapsplat.com** - Free tier available
- **OpenGameArt.org** - Audio section
- **BBC Sound Effects** - Some CC licensed

**Ambience/Music**:
- **Incompetech.com** - Royalty-free music (CC-BY)
- **Purple Planet Music** - Free royalty-free
- **Freesound.org** - Ambient loops

### AI Generation

- Can be used for placeholders
- Quality varies significantly
- **Always check licensing/ToS** for game usage
- Recommended tools: ElevenLabs, Mubert, AIVA (check licensing)

### Recording Custom

**Easy to Record**:
- Footsteps (walk on hard floor)
- Door creaks (old hinges)
- Container opens (wooden box)
- Locks (keys, latches)

**Process**:
1. Record with decent mic
2. Edit in Audacity (free)
3. Add reverb for depth
4. Normalize to proper levels
5. Export as OGG

---

## Testing

Once you have 1-2 audio files:

1. Place in correct directory
2. Name exactly as specified
3. Run game (`npm run dev`)
4. Check browser console for "[BootScene] Preloading X audio assets..."
5. Trigger event (e.g., take damage for hurt sound)
6. Should play immediately!

---

## Status Tracking

Use this checklist to track progress:

### Priority 1 - Critical (10 files)
- [ ] sfx_ambusher_scream.ogg
- [ ] sfx_ambusher_impact.ogg
- [ ] sfx_player_hurt.ogg
- [ ] sfx_interaction_container_open.ogg
- [ ] sfx_interaction_key_pickup.ogg
- [ ] sfx_progression_key_found.ogg
- [ ] sfx_interaction_locked.ogg
- [ ] sfx_interaction_unlock.ogg
- [ ] sfx_interaction_floor_transition.ogg
- [ ] sfx_jumpscare_lid_slam.ogg

### Priority 2 - Box Scares (8 files)
- [ ] sfx_jumpscare_hand_inside.ogg
- [ ] sfx_jumpscare_object_falls.ogg
- [ ] sfx_jumpscare_whisper.ogg
- [ ] sfx_jumpscare_screen_glitch.ogg
- [ ] sfx_jumpscare_false_mimic.ogg
- [ ] sfx_jumpscare_wall_shift.ogg
- [ ] sfx_jumpscare_shadow_figure.ogg

### Priority 3 - Player (10 files)
- [ ] sfx_player_footstep_1.ogg
- [ ] sfx_player_footstep_2.ogg
- [ ] sfx_player_footstep_3.ogg
- [ ] sfx_player_footstep_4.ogg
- [ ] sfx_player_footstep_sprint.ogg
- [ ] sfx_player_breathing_low.ogg
- [ ] sfx_flashlight_on.ogg
- [ ] sfx_flashlight_off.ogg
- [ ] sfx_flashlight_flicker.ogg
- [ ] sfx_flashlight_depleted.ogg

**Continue for remaining priorities...**

---

**Last Updated**: 2026-09-09  
**System Status**: ✅ Ready for audio assets  
**Files Needed**: 61 total (59 essential, 2 optional)
