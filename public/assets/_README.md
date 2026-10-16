# Runtime assets

This tree contains the production images and processed audio loaded by the
game. Runtime path and dimension manifests live in `src/game/` and
`src/core/audioAssetManifest.ts`; BootScene preloads the registered assets.
PNG assets use nearest-neighbor presentation where appropriate. Audio and
asset rights are tracked separately in the repository-root
`ASSET_CREDITS.md`, `AUDIO_LICENSES.md`, and `docs/audio/THIRD_PARTY_AUDIO.md`.

## Layout

- `audio/` — processed OGG ambience, music, and effects; source recordings
  live under `docs/audio/sources/` for provenance.
- `sprites/characters/player/` — four authored idle directions and eight
  authored walking frames (20×28).
- `sprites/characters/stalker/` — four authored idle directions and eight
  authored walking frames (32×52).
- `sprites/enemies/` — Ambusher, Crawler, Watcher, and Mimic production art.
- `sprites/environment/shared/` — Blocks 4–1 shared surfaces, props, and
  containers.
- `sprites/environment/blocks/` — block-specific environmental details,
  including Block 13's authored architecture.
- `sprites/narrative/` — presentation art for the victory epilogue.

The manifest entries and asset regression tests are the source of truth. Do
not add a runtime asset without registering its path and documenting its
creator/source, license, and any required attribution.
