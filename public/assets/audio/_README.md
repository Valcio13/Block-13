# Block 13 Audio Assets

This directory contains all audio assets for Block 13, organized by category.

**IMPORTANT**: The audio system is designed to handle missing assets gracefully. The game will not break if audio files are not present - it will simply log warnings and continue without sound.

## Directory Structure

```
audio/
├── player/           - Player footsteps, hurt, breathing
├── interactions/     - Container opening, key pickup, locks
├── flashlight/       - Flashlight toggle, flicker, depleted
├── environment/      - Ambient sounds, creaks, drips, hums
├── enemies/          - Enemy-specific sounds
│   ├── stalker/      - Stalker movement, breathing, chase, attack
│   ├── crawler/      - Crawler scraping, detection, attack
│   ├── watcher/      - Watcher presence drone, disappear
│   ├── mimic/        - Mimic tell, reveal, attack
│   └── ambusher/     - Ambusher pre-scare, scream, impact
├── jumpscares/       - Jump scare stingers and effects
├── progression/      - Key found, victory, objective complete
├── ambience/         - Looping ambient tracks (kept in root for now)
└── music/            - Music tracks (kept in root for now)
```

## File Format

**Recommended**: OGG or MP3  
**Sample Rate**: 44.1kHz or 48kHz  
**Bit Rate**: 192kbps or higher for music/ambience, 128kbps for SFX  

Phaser 3 supports: MP3, OGG, WAV, M4A (browser-dependent)

## Required Assets

### Player (`player/`)

| Filename | Description | Type | Notes |
|----------|-------------|------|-------|
| `sfx_player_footstep_1.ogg` | Footstep variant 1 | SFX | ~0.2-0.3s |
| `sfx_player_footstep_2.ogg` | Footstep variant 2 | SFX | Slight variation |
| `sfx_player_footstep_3.ogg` | Footstep variant 3 | SFX | Slight variation |
| `sfx_player_footstep_4.ogg` | Footstep variant 4 | SFX | Slight variation |
| `sfx_player_footstep_sprint.ogg` | Sprint footstep | SFX | Faster, heavier |
| `sfx_player_hurt.ogg` | Player takes damage | SFX | Short pain sound |
| `sfx_player_breathing_low.ogg` | Low health breathing | SFX | Loopable, heavy breathing |

**Status**: All missing

### Interactions (`interactions/`)

| Filename | Description | Type | Notes |
|----------|-------------|------|-------|
| `sfx_interaction_container_open.ogg` | Open container/search | SFX | Creak, wood/metal |
| `sfx_interaction_key_pickup.ogg` | Pick up key | SFX | Metallic jingle |
| `sfx_interaction_locked.ogg` | Try locked door/stairs | SFX | Rattle, reject |
| `sfx_interaction_unlock.ogg` | Unlock stairs | SFX | Lock mechanism, success |
| `sfx_interaction_floor_transition.ogg` | Floor transition | SFX | Descending stairs |

**Status**: All missing

### Flashlight (`flashlight/`)

| Filename | Description | Type | Notes |
|----------|-------------|------|-------|
| `sfx_flashlight_on.ogg` | Flashlight toggle on | SFX | Click, buzz |
| `sfx_flashlight_off.ogg` | Flashlight toggle off | SFX | Click |
| `sfx_flashlight_flicker.ogg` | Low battery flicker | SFX | Electrical sputter |
| `sfx_flashlight_depleted.ogg` | Battery empty | SFX | Dying buzz |

**Status**: All missing

### Environment (`environment/`)

| Filename | Description | Type | Notes |
|----------|-------------|------|-------|
| `amb_environment_fluorescent_hum.ogg` | Fluorescent light hum | AMB | Loopable, low drone |
| `amb_environment_creak_1.ogg` | Building creak variant 1 | AMB | ~1-2s |
| `amb_environment_creak_2.ogg` | Building creak variant 2 | AMB | ~1-2s |
| `amb_environment_creak_3.ogg` | Building creak variant 3 | AMB | ~1-2s |
| `amb_environment_distant_impact.ogg` | Distant impact/bang | AMB | ~0.5-1s |
| `amb_environment_dripping_water.ogg` | Dripping water | AMB | Loopable |
| `sfx_environment_moving_wall.ogg` | Wall reconfiguration | SFX | Grinding, mechanical |

**Status**: All missing

### Stalker (`enemies/stalker/`)

| Filename | Description | Type | Notes |
|----------|-------------|------|-------|
| `sfx_stalker_distant_movement.ogg` | Distant stalker sound | SFX | Far-off footsteps |
| `sfx_stalker_footsteps.ogg` | Stalker footsteps | SFX | Heavy, slow |
| `sfx_stalker_breathing.ogg` | Stalker presence breathing | SFX | Loopable, deep |
| `sfx_stalker_detected.ogg` | Player detected | SFX | Alert sound |
| `sfx_stalker_chase.ogg` | Chase music/sound | SFX | Fast footsteps |
| `sfx_stalker_attack.ogg` | Stalker attack hit | SFX | Impact, scream |

**Status**: All missing

### Crawler (`enemies/crawler/`)

| Filename | Description | Type | Notes |
|----------|-------------|------|-------|
| `sfx_crawler_movement.ogg` | Crawling/scraping | SFX | Skittering, nails |
| `sfx_crawler_detection.ogg` | Crawler detects player | SFX | Hiss, chittering |
| `sfx_crawler_attack.ogg` | Crawler lunge attack | SFX | Quick strike |

**Status**: All missing

### Watcher (`enemies/watcher/`)

| Filename | Description | Type | Notes |
|----------|-------------|------|-------|
| `amb_watcher_presence.ogg` | Watcher presence drone | AMB | Loopable, unsettling |
| `sfx_watcher_disappear.ogg` | Watcher teleport/vanish | SFX | Whoosh, distortion |

**Status**: All missing

### Mimic (`enemies/mimic/`)

| Filename | Description | Type | Notes |
|----------|-------------|------|-------|
| `sfx_mimic_tell.ogg` | Subtle mimic tell | SFX | Faint breathing/creak |
| `sfx_mimic_reveal.ogg` | Mimic reveals itself | SFX | Container bursting open |
| `sfx_mimic_attack.ogg` | Mimic attack | SFX | Teeth, lunge |

**Status**: All missing

### Ambusher (`enemies/ambusher/`)

| Filename | Description | Type | Notes |
|----------|-------------|------|-------|
| `sfx_ambusher_pre_scare.ogg` | Subtle pre-jumpscare cue | SFX | Faint breathing, 0.2-0.4s |
| `sfx_ambusher_scream.ogg` | Jumpscare scream | SFX | LOUD, 0.5-1s |
| `sfx_ambusher_impact.ogg` | Impact/hit sound | SFX | Heavy thud |

**Status**: All missing

### Jumpscares (`jumpscares/`)

| Filename | Description | Type | Notes |
|----------|-------------|------|-------|
| `sfx_jumpscare_lid_slam.ogg` | Lid slams shut | SFX | Sudden bang |
| `sfx_jumpscare_hand_inside.ogg` | Hand appears in box | SFX | Gasp, movement |
| `sfx_jumpscare_object_falls.ogg` | Object falls nearby | SFX | Crash |
| `sfx_jumpscare_whisper.ogg` | Whisper behind player | SFX | Close whisper |
| `sfx_jumpscare_screen_glitch.ogg` | Screen glitch sound | SFX | Digital distortion |
| `sfx_jumpscare_false_mimic.ogg` | False mimic lunge | SFX | Container burst |
| `sfx_jumpscare_wall_shift.ogg` | Wall shifts/moves | SFX | Grinding stone |
| `sfx_jumpscare_shadow_figure.ogg` | Shadow figure appears | SFX | Whoosh, echo |
| `sfx_jumpscare_door_slam.ogg` | Door slams shut | SFX | Heavy slam |
| `sfx_jumpscare_footsteps.ogg` | Sudden footsteps | SFX | Running steps |
| `sfx_jumpscare_false_stalker.ogg` | False stalker appear | SFX | Heavy breathing |
| `sfx_jumpscare_sudden_noise.ogg` | Generic loud noise | SFX | Bang, crash |

**Status**: All missing

### Progression (`progression/`)

| Filename | Description | Type | Notes |
|----------|-------------|------|-------|
| `sfx_progression_key_found.ogg` | Key collected | SFX | Success chime |
| `sfx_progression_block13_reveal.ogg` | Entering Block 13 | SFX | Ominous reveal |
| `sfx_progression_objective_complete.ogg` | Objective complete | SFX | Minor success |
| `sfx_progression_victory.ogg` | Escape complete | SFX | Victory stinger |

**Status**: All missing

### Ambience (Looping Tracks)

| Filename | Description | Type | Notes |
|----------|-------------|------|-------|
| `amb_floor_general.ogg` | General floor ambience | AMB | Loopable, 30s+ |
| `amb_floor_deep.ogg` | Deep floor ambience | AMB | Darker, heavier |
| `amb_block13.ogg` | Block 13 ambience | AMB | Most ominous |

**Status**: All missing

### Music (Optional)

| Filename | Description | Type | Notes |
|----------|-------------|------|-------|
| `music_main_theme.ogg` | Main menu theme | MUSIC | Loopable |
| `music_chase_theme.ogg` | Chase sequence music | MUSIC | Tense, loopable |

**Status**: All missing

## Audio Guidelines

### Volume Levels

- **SFX**: Normalized to -3dB to -6dB peak
- **Ambience**: -12dB to -18dB (quieter, background)
- **Music**: -9dB to -12dB (balanced)
- **Jumpscares**: -3dB (louder for impact, but not clipping)

### Horror Audio Design

**Do**:
- Use silence strategically
- Layer ambient sounds subtly
- Keep enemy audio informative but not precise
- Make jumpscares punchy but not ear-damaging
- Use lo-fi/degraded quality for creepiness
- Add reverb for environment depth

**Don't**:
- Spam constant sounds
- Make every footstep identical
- Reveal exact enemy positions through audio alone
- Overlap multiple loud scares
- Use stock "monster roar" clichés

### Sourcing Audio

**Recommended CC0/Free Sources**:
- **Freesound.org** (CC0 and CC-BY)
- **OpenGameArt.org** (audio section)
- **Zapsplat.com** (free tier)
- **BBC Sound Effects** (some CC licensed)

**Tools**:
- **Audacity** (free, editing/mixing)
- **REAPER** (affordable DAW)
- **Paulstretch** (time stretching for ambience)

**AI Generation** (use cautiously, verify licensing):
- Can generate placeholders
- Quality varies
- Check ToS for game usage

### File Naming

- Use lowercase
- Use underscores, not spaces or hyphens
- Include category prefix: `sfx_`, `amb_`, `music_`
- Use descriptive names
- Include variant numbers: `_1`, `_2`, `_3`

## Integration

Audio assets are loaded in `BootScene` and managed by `AudioDirector`.

See `src/core/audioDirector.ts` for audio key constants and `AUDIO_KEYS` reference.

## Status

**Current**: All placeholders - system functional but silent  
**Priority**: Ambusher scream, stalker footsteps, jumpscare stingers, player footsteps  
**Next**: Environment ambience, container sounds, flashlight  

---

Last Updated: 2026-09-09  
System: Implemented and tested, awaiting real assets
