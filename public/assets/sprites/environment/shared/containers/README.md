# Shared searchable container sprites

The eight 32×32 RGBA PNGs in this folder were supplied by the project owner in
`block13_container_sprites.zip`. The bundled README describes them as original
pixel-drawn artwork generated specifically for this request, with no external
asset pack copied. The bundle does not state a license; permission terms are
therefore not independently established here.

All sprites use transparent backgrounds and nearest-neighbor presentation.
Closed/open pairs are registered in `src/game/environmentAssets.ts` and
preloaded by `BootScene`. Runtime state selection remains presentation-only.
