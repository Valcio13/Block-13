# Block 3 controlled-deterioration revision

## What changed

The earlier Refined Candidate was too regular: long panel seams and repeated tiny marks made it read like newly installed industrial cladding. The Original had more decay, but scattered high-contrast flecks competed with the floor plan. This revision keeps the candidate's calmer material grouping and adds a small number of legible, material-specific wear states.

### Pixel-art edits

Only `assets/refined_candidate/` was revised. The A/B industrial and residential variants and their historical previews were left intact.

- `floor_primary.png` is now a quiet, warm-gray concrete slab without peppered speckles.
- `floor_light_wear.png` and `floor_moderate_wear.png` add broad, low-contrast edge scuffing and localized exposed underlayer.
- `floor_damaged.png` has a rare chipped edge with a short branching fracture that starts at the slab boundary.
- `wall_primary.png` has fewer panel lines and a broad painted surface.
- `wall_stained.png` groups damp discoloration into one edge-following patch.
- `wall_patch.png` depicts old repair paint, with softened irregular margins.
- `wall_damaged.png` starts a small spall and hairline fracture at a wall joint.
- `wall_floor_transition.png` and `door_threshold.png` were redrawn to match the warmer plaster/concrete palette and retain clear boundaries.
- `room_notice.png` is a single faded, transparent block-number notice placed at a deterministic safe wall beside a doorway.

The new opaque floor/wall bases are 32×32; the notice is 32×32 RGBA with partial transparency. Existing candidate trim/detail/prop assets remain unchanged.

## Deterministic presentation selection

The refined experiment selects only from tile coordinates and the current walkable geometry. It does not read authoritative RNG. Protected start/key/exit/searchable and door cells always receive clean bases. Approximate wear weights are:

| Surface | Common | Light wear/stain | Repair/moderate wear | Rare damage |
|---|---:|---:|---:|---:|
| Floor | 69% | 19% | 9% | 3%, only beside a wall |
| Wall | 62% | 20% | 12% | 6%, joint-origin spall |

A stable 3×3 coordinate region contribution nudges neighboring selections toward similar grades, so marks form small zones instead of a uniform sprinkle. Repeated F8 switches use the same tile selection. The refined mode skips the former Block 3 procedural crack/stain pass so it cannot double up the authored surface wear. None of the tile arrays, colliders, map generation, actor positions, lighting, or simulation state are changed.

## Matched Phaser captures

Both files are genuine Phaser browser screenshots at 960×540. They show the same isolated local Block 3 run, player position, camera, map, and effects; F8 was the only action between the pair.

- [Original](captures/block3_refinement_overview_original.png)
- [Revised](captures/block3_refinement_overview_revised.png)

The saved run had an empty flashlight battery, so these revised captures are flashlight-off. The broad overview contains a corridor, several room sections, searchable-object positions, and doorway/threshold transitions, but the current camera fit shows most of the floor at once. They do not replace close-focus captures of the container, door/stair threshold, or larger room. The previous light-on images depict the older candidate and are not used to claim flashlight-on validation of this revision.

## Review

The revised candidate is more clearly aged than its previous version: large wall/floor patches establish wear at map scale without scattering cracks over every tile, while clean surfaces remain dominant. The repaired plaster and warm-gray underlayer help it sit between Block 4's maintained surfaces and Block 2's more explicit service/warning treatment. It stays well short of Block 1's structural fractures and Block 13's impossible/corrupt surfaces.

In the unlit game capture the authored wear is visible but still subdued, as intended; the environment remains very dark, and the drained battery prevented a direct revised flashlight-on comparison. Current doorway notice placement can also miss a doorway if all adjacent wall cells are protected. Those are remaining review points, not a reason to change the approved lighting or gameplay.

**Recommendation: Revise Again before approval.** This pass materially improves surface art and repetition over the former Refined Candidate, but the flashlight-on material contrast and the close interactable/threshold views still need direct review. Original remains the production default.

## Rebuild

Run `node art-experiments/block3-redesign/generate.mjs --refined-only` to regenerate just the revised candidate files. This leaves the alternate art directions and historical standalone previews alone. Run without the flag only when intentionally rebuilding the complete original experiment set.
