# Block 13 audio system

## Runtime and lifecycle

`AudioDirector` owns sound playback, master/category gains, mute state,
presentation cooldowns, temporary ambience ducking, and scene cleanup.
`BootScene` loads only `AUDIO_ASSET_MANIFEST` from
`src/core/audioAssetManifest.ts`; the manifest paths resolve to checked-in
files under `public/assets/audio/`. Catalog paths not promoted into that
manifest are staged/unused and are not requested by the loader.

Audio is presentation-only. `src/core/presentationAudio.ts` maps simulation
events and snapshot changes to cues. Playback, local cosmetic variants,
cooldowns, loops, and cleanup do not affect simulation state, input,
progression, or authoritative RNG.

The shared audio settings panel is available at the main menu and pause menu.
It saves master/SFX/ambience/music volumes and mute flags to browser
`localStorage`; live changes update active Phaser sounds from their stored
base gain. Settings previews use bounded one-shot HTML audio playback and
stop when replaced or when the panel closes. **Reduce Jumpscare Intensity**
changes only the rendered Ambusher flash, camera kick, and scale punch.

Floor ambience is selected for Floors 4–1 and Block 13. Dedicated looped music
is selected for Blocks 3, 1, and 13. The Block 13 Ambusher impact uses the
authored composite impact sting; generic jumpscare impact remains the fallback
for other scare events. Terminal states stop ambience/music according to the
scene lifecycle; shutdown removes active sound handles and listeners.

## Assets and provenance

See [AUDIO_LICENSES.md](../AUDIO_LICENSES.md) and
[docs/audio/THIRD_PARTY_AUDIO.md](audio/THIRD_PARTY_AUDIO.md) for source pages,
creators, licenses, modifications, and production destinations. The files in
`public/assets/audio/` are processed derivatives. Source recordings retained
for provenance live under `docs/audio/sources/`; the Ambusher mix master lives
under `docs/audio/masters/`.

The Pixabay Content License permits free use and modification subject to its
prohibited uses; it does not permit distributing the unmodified source as a
standalone asset. See the current [Pixabay license summary](https://pixabay.com/service/license-summary/)
and [terms](https://pixabay.com/service/terms/). The documented OpenGameArt
sources are listed as CC0 on their source pages. Credits and documentation do
not replace checking the license attached to a specific downloaded file.

## Verification limits

The audio manifest is checked for path existence by tests. Automated tests do
not establish that the subjective mix is correct on all devices. Verify
autoplay/unlock, category balance, mute/reset, and floor-loop transitions in a
real browser before release.
