# Block 3 in-game A/B review

## Setup

- Phaser dev build, local run, Block 3 reached through ordinary Block 4 play.
- One generated run and map used for both modes; F8 changed only the static environment texture.
- Original was the default. Repeated F8 switches returned to the same scene without a restart.
- Paired fullroom captures are 960×540. The earlier corridor captures are 959×540 because that was the in-app screenshot output at its nominal 960 px viewport setting.
- Captures are real browser/Phaser output, not the standalone preview compositor.

## Refined candidate assessment

The candidate improves material grouping: floors read as concrete slabs, walls read as panelled surfaces, and floor/wall transitions are easy to follow. Its cooler, quieter palette has fewer saturated stains than the existing Block 3 treatment.

In the actual game view, the candidate is too even and too repetitive to carry Block 3's neglected identity. The same fine panel seams repeat across long wall runs, and the small regular floor marks read as a new industrial finish more than accumulated wear. The candidate also moves closer to a clean maintenance corridor than the requested progression from orderly Block 4 through deteriorating Block 3. The Original is noisier and its pink/rust flecks are a little strong, but it currently communicates deterioration more clearly.

The light-on screenshots show the actual runtime state and composition. At this overview scale, the beam's local material response is too subtle to judge fine contrast or small transparent details reliably. No darkness or flashlight tuning was made.

## Coverage limits

The camera shows a broad portion of the 39×33 tile map, so the captures include corridor, room, wall, floor, and threshold context together. This pass did not produce separate close-focus matched pairs for a searchable container, a door/stair threshold, and a larger open area. Those need a closer framing or a second capture run before final art approval. The current images are sufficient to reject immediate production approval, but not to sign off every interactable/detail placement.

## Recommendation

**Revise the candidate; keep Original in production.** Preserve the candidate's clearer floor/wall grouping, reduce the regular micro-seam/dot repetition, and add sparse broad wear or peeling clusters that distinguish Block 3 from Block 4 while remaining less industrial than Block 2. Review the revised pass again with focused container and stair/door captures. Production approval remains with the user.

## Production integration steps after approval

1. Select the approved authored tile set and move it from `assets/refined_candidate/` into the production Block 3 asset directory.
2. Register the approved assets in `environmentAssets.ts` and load them through `BootScene`.
3. Keep surface/overlay selection based on stable tile coordinates and existing geometry; do not consume authoritative RNG.
4. Keep the presentation replacement confined to the static floor composition. Retain the existing geometry, lighting, player, enemies, containers, doors, stairs, and simulation behavior.
5. Add production asset manifest/placement tests, then run the relevant suite, full `npm test`, production build, and `git diff --check`.
6. Remove the development-only F8 experiment loader and switch after the production art pass is approved and integrated.
