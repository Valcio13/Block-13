# Audio source and license record

Checked **2026-10-05**. These are third-party recordings downloaded from Pixabay and edited for Block 13. Pixabay marks each source page “Free for use under the Pixabay Content License.” The current license summary permits commercial use and does not require attribution; the terms prohibit distributing content on a standalone basis. The OGG files here are trimmed/mixed cues bundled as part of the game. See the [Pixabay Content License summary](https://pixabay.com/service/license-summary/) and [Terms of Service](https://pixabay.com/service/terms/). Attribution is optional under those terms; credits are retained below.

For Freesound-syndicated items, Pixabay shows the source title and creator attribution but does not expose the contributor's original upload filename. The recorded filename below is the exact name returned by Pixabay's download.

| Original/source filename | Source / creator | License / attribution | Block 13 destination |
|---|---|---|---|
| `freesound_community-footsteps-on-concrete-39202.mp3` (Pixabay download; contributor upload filename not exposed) | [Footsteps on concrete](https://pixabay.com/sound-effects/household-footsteps-on-concrete-39202/) — patchytherat (Freesound) | Pixabay Content License; commercial use permitted; attribution not required (credit optional) | `public/assets/audio/player/sfx_player_footstep_1.ogg`, `_2.ogg`, `_3.ogg` |
| `alex_jauk-industrial-ambience-223058.mp3` | [Industrial Ambience](https://pixabay.com/sound-effects/technology-industrial-ambience-223058/) — Alex_Jauk | Pixabay Content License; commercial use permitted; attribution not required (credit optional) | `public/assets/audio/ambience/amb_floor_4.ogg`, `_3.ogg`, `_2.ogg`, `amb_block13.ogg` |
| `freesound_community-electrical-hum-g-slightly-sharp-17887.mp3` (Pixabay download; contributor upload filename not exposed) | [Electrical hum G slightly sharp](https://pixabay.com/sound-effects/technology-electrical-hum-g-slightly-sharp-17887/) — survivalbag (Freesound) | Pixabay Content License; commercial use permitted; attribution not required (credit optional) | `public/assets/audio/ambience/amb_floor_3.ogg`, `_2.ogg`, `amb_floor_1.ogg`, `amb_block13.ogg` |
| `dragon-studio-deep-haunting-drone-482880.mp3` | [Deep Haunting Drone](https://pixabay.com/sound-effects/film-special-effects-deep-haunting-drone-482880/) — DRAGON-STUDIO | Pixabay Content License; creator states commercial and personal use permitted; attribution optional | `public/assets/audio/ambience/amb_floor_1.ogg`, `amb_block13.ogg` |
| `strachszydlo-turning-on-and-off-a-flashlight-click-sound-502512.mp3` | [Turning on and off a flashlight (click sound)](https://pixabay.com/sound-effects/technology-turning-on-and-off-a-flashlight-click-sound-502512/) — STRACHszydło | Pixabay Content License; commercial use permitted; attribution not required (credit optional) | `public/assets/audio/flashlight/sfx_flashlight_on.ogg`, `sfx_flashlight_off.ogg` |
| `freesound_community-door-rattle-86870.mp3` (Pixabay download; contributor upload filename not exposed) | [Door Rattle](https://pixabay.com/sound-effects/household-door-rattle-86870/) — harrietniamh (Freesound) | Pixabay Content License; commercial use permitted; attribution not required (credit optional) | `public/assets/audio/interactions/sfx_interaction_search.ogg` |
| `freesound_community-item-pick-up-38258.mp3` (Pixabay download; contributor upload filename not exposed) | [Item Pick Up](https://pixabay.com/sound-effects/film-special-effects-item-pick-up-38258/) — Mr._Fritz_ (Freesound) | Pixabay Content License; commercial use permitted; attribution not required (credit optional) | `public/assets/audio/interactions/sfx_item_pickup.ogg` |
| `freesound_community-key-get-39925.mp3` (Pixabay download; contributor upload filename not exposed) | [Key get](https://pixabay.com/sound-effects/household-key-get-39925/) — Mendenhall02 (Freesound) | Pixabay Content License; commercial use permitted; attribution not required (credit optional) | `public/assets/audio/interactions/sfx_key_pickup.ogg` |
| `dragon-studio-male-groan-of-pain-357971.mp3` | [Male Groan of Pain](https://pixabay.com/sound-effects/people-male-groan-of-pain-357971/) — DRAGON-STUDIO | Pixabay Content License; creator states commercial and personal use permitted; attribution optional | `public/assets/audio/player/sfx_player_hurt_1.ogg`, `sfx_player_hurt_2.ogg` |
| `freesound_community-monster-chase-grunts-45476.mp3` (Pixabay download; contributor upload filename not exposed) | [Monster Chase Grunts](https://pixabay.com/sound-effects/horror-monster-chase-grunts-45476/) — surfaceknight68 (Freesound) | Pixabay Content License; commercial use permitted; attribution not required (credit optional) | `public/assets/audio/enemies/stalker/sfx_stalker_hunt.ogg` |
| `universfield-horror-impact-hit-567238.mp3` | [Horror Impact Hit](https://pixabay.com/sound-effects/horror-horror-impact-hit-567238/) — Universfield | Pixabay Content License; commercial use permitted; attribution not required (credit optional) | `public/assets/audio/jumpscares/sfx_jumpscare_hit.ogg` |

## Processing record

- All checked-in files are OGG/Vorbis, mono, 24 kHz. No generated audio is included.
- Footsteps: three short, differently timed cuts from the same concrete-walk recording, with short edge fades and conservative loudness normalization.
- Flashlight: the first two separated toggle clicks from the source recording were cut into on/off cues, faded, and normalized.
- Floor ambience: five 24-second loop beds were assembled from the industrial ambience, electrical hum, and drone sources. Per-floor filter and layer balance changes the progression; 0.8-second fades soften loop boundaries.
- Search: a short cut of the door-handle rattle, faded and normalized.
- Item pickup and key pickup: source starts trimmed, then short tails faded and normalized.
- Hurt: a short pain-groan cut and a second version pitched up by 4% to provide the two playback variants.
- Stalker hunt: a trimmed section of the chase-grunt recording.
- Jumpscare: a restrained 2.3-second cut of the impact, faded and normalized.

The downloadable source MP3s remain outside the repository. Only the processed game cues listed above are included.
