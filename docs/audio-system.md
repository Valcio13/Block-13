# Block 13 audio system

## Current status

Block 13 now has its first checked-in audio pack. `AudioDirector` owns playback, category volumes, optional positional falloff, presentation-only cooldowns, and cleanup. `BootScene` loads only `AUDIO_ASSET_MANIFEST`; every active manifest path is checked in under `public/assets/audio`. Unlisted cues remain silent no-ops.

Audio is presentation-only. `src/core/presentationAudio.ts` maps authoritative events and snapshot changes to cues. Sound playback, variant selection, cooldowns, loops, and scene cleanup do not affect simulation state, input, progression, or authoritative RNG. Cosmetic audio uses AudioDirector's private seeded RNG.

## Active mapping

| Event or state edge | Audio | Behavior |
|---|---|---|
| Player movement | `sfx_player_footstep_1..3` | Short tick-cadenced variants while moving |
| Flashlight toggle | `sfx_flashlight_on`, `sfx_flashlight_off` | Short one-shots |
| Search / ordinary pickup / key | `sfx_interaction_search`, `sfx_item_pickup`, `sfx_key_pickup` | One-shots from authoritative result events |
| Damage | `sfx_player_hurt_1..2` | Two mild variants |
| Stalker starts hunting | `sfx_stalker_hunt` | Positional chase cue |
| Generic scare | `sfx_jumpscare_hit` | Restrained one-shot when no specific scare cue is selected |
| Floors 4–1 and Block 13 | `amb_floor_4`, `_3`, `_2`, `_1`, `amb_block13` | One dedicated loop for the current floor |

Floor changes stop the prior scene's loops during scene shutdown and start the next floor's dedicated loop. Death and victory stop ambience while allowing terminal one-shots to finish. Scene restart/shutdown calls `AudioDirector.shutdown()` to stop all remaining playback.

Ambience playback uses a conservative per-sound volume of 0.32 (then master/category scaling). One-shots use their event-specific levels in `FloorScene`. Floor beds are 24-second authored mixes with soft fades at the loop boundaries.

## Source and processing

See [AUDIO_LICENSES.md](../AUDIO_LICENSES.md) for each downloaded source filename, original source page, creator, license, attribution requirement, destination file, and processing details. All source pages were verified under the Pixabay Content License. The active game files are edited OGG derivatives; raw source downloads are not in this repository. No generated audio or placeholder audio is included.

## Asset layout

```text
public/assets/audio/
  ambience/       floor 4–1 and Block 13 loops
  enemies/stalker/ Stalker hunt cue
  flashlight/     flashlight on/off
  interactions/   search, item, and key pickup
  jumpscares/     generic scare impact
  player/         footsteps and hurt variants
```

Catalog entries without a checked-in file remain inactive. When adding sources, record provenance in `AUDIO_LICENSES.md` before adding them to `AUDIO_ASSET_MANIFEST`.

## Replay safety

Gameplay trigger/state comes from deterministic simulation outputs. Ambient transitions observe floor state. Audio cooldowns use wall-clock time only as a presentation throttle. Visual or audio activity must not consume WORLD, ECONOMY, EVENT, or enemy gameplay RNG streams. See the unit tests for floor cue selection, manifest file existence, cue mappings, and cosmetic isolation.

## Remaining silent cues

The first pack does not include battery warning, corruption pulse, death, escape, generic danger stinger, Block 13 arrival/final chase stingers, crawler, watcher, ambusher, or mimic-specific sounds. Those catalog keys remain disabled until appropriate licensed assets are sourced.
