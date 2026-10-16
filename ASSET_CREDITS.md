# Block 13 Asset Credits and Rights Record

This is the current production asset index. Older replacement plans are kept
in the repository as historical notes; they do not describe the shipped art.

## Code and project license

The software is licensed under the MIT License in [LICENSE](LICENSE). The
MIT license does not automatically apply to bundled artwork, audio, or other
media. Audio rights and sources are documented separately in
[AUDIO_LICENSES.md](AUDIO_LICENSES.md) and
[docs/audio/THIRD_PARTY_AUDIO.md](docs/audio/THIRD_PARTY_AUDIO.md).

## Production graphics

The production loader manifests are the authoritative inventory and path
record:

- Player and Stalker: `src/game/playerAssets.ts` and `src/game/stalkerAssets.ts`
- Crawler, Watcher, Mimic, and Ambusher: `src/game/enemyAssets.ts`
- Shared and Block 4–1 environment: `src/game/environmentAssets.ts`
- Block 13 environment: `src/game/block13Assets.ts`
- Victory background: `src/game/narrativeAssets.ts`

The exhaustive file-by-file status is in
[`docs/visual-asset-provenance.md`](docs/visual-asset-provenance.md). It
includes every PNG under `public/assets`, including runtime purpose, manifest
evidence, creator/source status, license/attribution status, and redistribution
status. Every supplied visual bundle remains unresolved until the rights-holder
and public release permission are documented. Existing bundled images are
retained in the working tree pending that decision.

The current repository does not establish whether the art is original,
generated, edited from third-party material, or based on external references.
No names, source files, generation records, reference list, transfer records,
or explicit license grant for these visual bundles were found. This remains a
public-release blocker. Do not infer that they are MIT-licensed from the code
license.

## Production audio

Third-party sources and processing are recorded in the two audio documents
linked above. The records identify source pages, creators, license terms, and
the processed game destinations. OpenGameArt source pages identify the listed
Ambusher and music selections as CC0. Pixabay source downloads are covered by
Pixabay's Content License, not automatically CC0; see the official [license
summary](https://pixabay.com/service/license-summary/) and [terms of
service](https://pixabay.com/service/terms/). Keep the source/download records
with the project provenance.

The current runtime audio manifest is `src/core/audioAssetManifest.ts`. Only
processed files under `public/assets/audio/` are loaded by the game; source
recordings under `docs/audio/sources/` are retained for provenance.

## Release rule

Before distributing a release, ensure every external or contributor-provided
asset has an identifiable creator/source and documented permission covering
the intended contest, public repository, and game distribution. Maintain
required notices alongside the shipped game where the applicable license
requires them.

## Investigation and puzzle UI

The Field Journal frame and puzzle-panel treatments are authored directly in
`src/game/scenes/FloorScene.ts` with Phaser drawing primitives and text. They
use no third-party images, fonts, or audio and have no external asset license.
