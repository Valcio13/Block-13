# Block 3 texture and provenance notes

## Native tile set (each direction)

| File | Native size | Alpha | Intended use |
|---|---:|---|---|
| `floor_primary.png` | 32×32 | No | Main seamless walkable slab |
| `floor_secondary.png` | 32×32 | No | Sparse alternate slab; coordinate-selected |
| `floor_damaged.png` | 32×32 | No | Rare damaged floor replacement, not a collision change |
| `wall_primary.png` | 32×32 | No | Main wall face |
| `wall_damaged.png` | 32×32 | No | Sparse peeled/spalled wall replacement |
| `wall_floor_transition.png` | 32×32 | No | Wall-to-walkable boundary treatment, orientation-selected |
| `door_threshold.png` | 32×32 | Yes | Surface trim over existing door cell |
| `environmental_detail_01.png` | 32×32 | Yes | Wall-mounted service plate / faded room detail |
| `environmental_detail_02.png` | 32×32 | Yes | Vent / trim accent |
| `decorative_prop.png` | 32×48 | Yes | Optional wall-adjacent architectural prop; art-only |

## Block 3 direction notes

### Industrial Decay

- Palette: cold gray concrete, desaturated steel blue, dark rust brown, very sparse aged yellow.
- Floor: quiet slab seams with a few broad wear patches; keep base and secondary seamless at the tile boundary.
- Wall: repeatable panel faces with rust on hardware edges, never broad orange noise.
- Damage/detail: one restrained spall edge, one compact service fixture, no dense pipe bundles.
- Keep hazard-yellow accents below the frequency used on Block 2.

### Abandoned Residential

- Palette: dirty beige-gray, desaturated olive, aged brown, cold shadow gray.
- Floor: worn large-format flooring, not parquet or a domestic pattern.
- Wall: tired plaster and paint edge; water damage in a few clusters rather than full-tile mottling.
- Details: quiet room-identification or old frame cues; no gothic decoration and no loose clutter that obscures navigation.

### Refined Candidate (controlled-deterioration revision)

- Preserve the shared building's industrial structure and slab scale.
- Use only understated domestic traces as story accents; they should not create a new architectural language.
- Keep rust, damage, and room labels more selective than their source directions.
- Maintain strong wall/floor contrast when the darkness multiplier is applied.
- Let clean wall and floor faces dominate. Use broad localized wear rather than regular specks.
- Put floor chips against wall edges and start wall spalls at panel/joint boundaries.
- Use one low-contrast faded room notice as the only explicit occupancy-history cue.
- Keep doorway and wall-floor transitions within the same muted concrete/plaster palette.

## Asset provenance

The 35 tile/prop PNGs across the three directions are original low-resolution pixel-cluster drawings generated deterministically by `generate.mjs` (Node built-ins only). The revised Refined Candidate uses hand-placed pixel clusters for localized plaster/water damage and edge wear; it uses no third-party artwork. The three images in `references/` were created with the built-in image-generation tool as mood references; none were cropped or used as production textures. Production Block 3/shared assets are read only by the comparison renderer and remain unchanged.

Use `node art-experiments/block3-redesign/generate.mjs --refined-only` to regenerate the updated refined textures without touching the alternate art directions or the historic standalone previews.

The comparison generator uses the production 32×32 surface assets and ordinary surface pool for the baseline, a shared hard-coded representative topology, the production player idle-right sprite, a dark ambient approximation, and a tile-blocked directional cone. It does not invoke Phaser, the generated level seed, production lightmap graphics, doors/search interactions, or the camera follow loop. Those are explicit limits of this art-direction prototype.
