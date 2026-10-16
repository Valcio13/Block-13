# Block 13 audio provenance

The original source files used for the current production encodes are retained
in `docs/audio/sources/`. The Ambusher production WAV master is retained in
`docs/audio/masters/`; only the OGG files under `public/assets/audio/` are
loaded by the game. No source archives are included in the production assets.

All listed sources are marked CC0 on their original OpenGameArt pages. CC0
permits reuse without attribution; this record is kept for project provenance.

## Ambusher impact sting

| Source | Creator | Original source | License | Modifications |
| --- | --- | --- | --- | --- |
| `monster-8.wav` from *Monster Sound Effects 2* | Ogrebane | https://opengameart.org/content/monster-sound-effects-2 | CC0 | Trimmed to its strong transient attack (source start at approximately 177 ms), added a 2 ms anti-click attack, resampled to 48 kHz, and placed at 0 ms. The strongest short-window peak lands approximately 2 ms into the final OGG. |
| `monster_04.ogg` from *80 CC0 creature SFX* | rubberduck | https://opengameart.org/content/80-cc0-creature-sfx | CC0 | Trimmed approximately 112 ms weak lead, reduced in level, faded through the short creature tail, resampled to 48 kHz. |
| `metal_interaction1.wav` from *Metal Interactions* | qubodup | https://opengameart.org/content/metal-interactions | CC0 | Trimmed approximately 102 ms weak lead, reduced substantially, delayed 35 ms and faded as a quiet abrasive layer, resampled to 48 kHz. |
| Original 90 Hz sine body | Block 13 project | Created for this mix; no external source | Original project audio | 160 ms, 4 ms attack fade, rapid 40 ms release beginning at 120 ms, restrained level; no sustained sub-bass. |

The layers were mixed to 0.70 seconds, mastered with a -15 LUFS integrated
target and -3 dBTP ceiling, then encoded as 48 kHz stereo Vorbis quality 6 to
`public/assets/audio/enemies/ambusher/sfx_ambusher_impact.ogg`. The production
master is `docs/audio/masters/sfx_ambusher_impact.wav` (48 kHz, 24-bit stereo).
The lossy production encode measures approximately -16.6 LUFS and -3.0 dBTP.

## Floor music

| Source | Creator | Original source | License | Modifications |
| --- | --- | --- | --- | --- |
| *Airy* from *Dark Sci-Fi Audio Pack* | SRG774 | https://opengameart.org/content/dark-sci-fi-audio-pack | CC0 | Trimmed approximately 730 ms leading quiet; rebuilt the circular boundary with a 750 ms tail/head crossfade; 48 kHz stereo master target -26 LUFS / -8 dBTP; encoded to 48 kHz Vorbis quality 6. Final OGG measures about -25.2 LUFS / -13.0 dBTP; loop duration 62.52 s. |
| *Lost in a bad place (horror ambience loop)* | congusbongus | https://opengameart.org/content/lost-in-a-bad-place-horror-ambience-loop | CC0 | Rebuilt the circular boundary with a 750 ms tail/head crossfade; 48 kHz stereo master target -24 LUFS / -6 dBTP; encoded to 48 kHz Vorbis quality 6. Final OGG measures about -24.1 LUFS / -9.0 dBTP; loop duration 24.815 s. |
| *Echoes of the Past* | isaiah658 | https://opengameart.org/content/echoes-of-the-past | CC0 | Rebuilt the circular boundary with a 1 second tail/head crossfade; 48 kHz stereo master target -25 LUFS / -7 dBTP; encoded to 48 kHz Vorbis quality 6. Final OGG measures about -24.4 LUFS / -13.1 dBTP; loop duration 46.996 s. |

The production OGG files are `music_block3_airy.ogg`,
`music_block1_lost.ogg`, and `music_block13_echoes.ogg` in
`public/assets/audio/music/`. Their original source files are retained under
`docs/audio/sources/`; the intermediate music WAV masters were not retained.
The gains in code are starting mix trims only; final subjective balance
requires in-game listening. Processing measurements and the generated loop
boundaries do not establish that any track sounds good in context.

## Original enemy cues (2026-10-12)

The following cues were composed for this project with the deterministic,
source-available synthesizer in `tools/audio/generate_enemy_cues.py`. They are
original project audio with no third-party samples or licensing restrictions.
The uncompressed 48 kHz, 24-bit mono WAV masters are kept in
`docs/audio/masters/enemies/`; the runtime OGG/Vorbis encodes are mono, 48 kHz,
quality 5. The listed peak and RMS values were measured from the decoded OGG
with FFmpeg `astats`; they are signal measurements, not a subjective mix
approval.

| Cue | Runtime file | Duration | Decoded peak | RMS | Use |
| --- | --- | ---: | ---: | ---: | --- |
| Stalker presence | `sfx_stalker_presence.ogg` | 0.82 s | -12.4 dBFS | -23.7 dBFS | Quiet positional first reveal; the existing hunt cue remains for pursuit/near-miss. |
| Watcher presence | `sfx_watcher_presence.ogg` | 0.78 s | -13.5 dBFS | -27.5 dBFS | Subtle positional active-state arrival cue. |
| Watcher vanish | `sfx_watcher_vanish.ogg` | 0.46 s | -14.7 dBFS | -27.4 dBFS | Quiet positional disappearance cue. |
| Watcher gaze | `sfx_watcher_gaze.ogg` | 0.38 s | -18.2 dBFS | -33.4 dBFS | Very quiet positional tick when an already-active Watcher enters the authoritative gaze cone. |
| Crawler skitter 1 | `sfx_crawler_skitter_1.ogg` | 0.34 s | -11.0 dBFS | -25.6 dBFS | Positional chase-onset variant. |
| Crawler skitter 2 | `sfx_crawler_skitter_2.ogg` | 0.34 s | -11.5 dBFS | -25.8 dBFS | Alternate chase-onset variant. |
| Mimic reveal | `sfx_mimic_reveal.ogg` | 0.63 s | -10.4 dBFS | -24.6 dBFS | Positional unnatural reveal, distinct from ordinary search feedback. |
| Ambusher warning | `sfx_ambusher_warning.ogg` | 0.72 s | -16.3 dBFS | -28.8 dBFS | Quiet positional warning before the separately synchronized impact. |

The Ambusher warning peak is about 13.4 dB below the existing impact peak
(-3.0 dBFS decoded). The reduced jumpscare setting also applies a 0.56 gain to
the warning and impact. The WAV masters are preserved for later listening or
mix adjustments. A gaze edge coinciding with first Watcher activation uses the
presence cue only, preventing layered one-shots; turning back toward an already
active Watcher can produce the separate, quieter gaze cue. Confirm subjective
levels in-game before release.
