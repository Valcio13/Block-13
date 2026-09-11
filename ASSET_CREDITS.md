# Asset Credits

This file tracks all external assets (graphics, audio, fonts, etc.) used in Block 13.

**Attribution Requirements**:
- All CC0 assets are listed for transparency, even though attribution is not legally required
- CC-BY and other licensed assets MUST be listed with proper attribution
- Generated/placeholder assets are marked as temporary
- Custom commissioned assets are marked as original

---

## Graphics

### Sprites

#### Player Character
**Status**: Placeholder (generated graphics)
- **Source**: Internal placeholder
- **License**: N/A (temporary)
- **Modifications**: None
- **Date Added**: 2026-09-09
- **Used For**: Player character sprite (32×48 colored rectangle)
- **TODO**: Replace with custom pixel art

#### Enemies

##### Crawler
**Status**: Placeholder (generated graphics)
- **Source**: Internal placeholder
- **License**: N/A (temporary)
- **Modifications**: None
- **Date Added**: 2026-09-09
- **Used For**: Crawler enemy sprite (32×32 colored rectangle)
- **TODO**: Replace with custom pixel art

##### Watcher
**Status**: Placeholder (generated graphics)
- **Source**: Internal placeholder
- **License**: N/A (temporary)
- **Modifications**: None
- **Date Added**: 2026-09-09
- **Used For**: Watcher enemy sprite (32×48 colored rectangle with amber eyes)
- **TODO**: Replace with custom pixel art

##### Stalker
**Status**: Placeholder (generated graphics)
- **Source**: Internal placeholder
- **License**: N/A (temporary)
- **Modifications**: None
- **Date Added**: 2026-09-09
- **Used For**: Stalker enemy sprite (48×64 colored rectangle)
- **TODO**: Replace with custom pixel art

##### Mimic
**Status**: Placeholder (generated graphics)
- **Source**: Internal placeholder
- **License**: N/A (temporary)
- **Modifications**: None
- **Date Added**: 2026-09-09
- **Used For**: Mimic enemy sprite (32×32 container, transforms to 48×48)
- **TODO**: Replace with custom pixel art

##### Ambusher
**Status**: Placeholder (generated graphics)
- **Source**: Internal placeholder
- **License**: N/A (temporary)
- **Modifications**: None
- **Date Added**: 2026-09-09
- **Used For**: Ambusher world sprite (32×48) and jumpscare face (400×400)
- **TODO**: Replace with custom horror pixel art

#### Environment

##### Floor Tiles
**Status**: Placeholder (generated graphics)
- **Source**: Internal placeholder
- **License**: N/A (temporary)
- **Modifications**: None
- **Date Added**: 2026-09-09
- **Used For**: Floor tiles (32×32 rectangles, various colors by floor)
- **TODO**: Replace with textured concrete/grating tiles

##### Wall Tiles
**Status**: Placeholder (generated graphics)
- **Source**: Internal placeholder
- **License**: N/A (temporary)
- **Modifications**: None
- **Date Added**: 2026-09-09
- **Used For**: Wall tiles (32×32 dark rectangles)
- **TODO**: Replace with cinderblock/metal wall tiles

##### Doors
**Status**: Placeholder (generated graphics)
- **Source**: Internal placeholder
- **License**: N/A (temporary)
- **Modifications**: None
- **Date Added**: 2026-09-09
- **Used For**: Door sprites (32×48 rectangles)
- **TODO**: Replace with detailed door sprites (open/closed/locked states)

##### Containers
**Status**: Placeholder (generated graphics)
- **Source**: Internal placeholder
- **License**: N/A (temporary)
- **Modifications**: None
- **Date Added**: 2026-09-09
- **Used For**: Searchable container sprites (32×32 brown rectangles)
- **TODO**: Replace with varied container sprites (boxes, crates, lockers, cabinets)

#### Items & Pickups

##### Key
**Status**: Placeholder (generated graphics)
- **Source**: Internal placeholder
- **License**: N/A (temporary)
- **Modifications**: None
- **Date Added**: 2026-09-09
- **Used For**: Floor key sprite (24×24 gold rectangle)
- **TODO**: Replace with detailed golden key sprite

##### Stairs
**Status**: Placeholder (generated graphics)
- **Source**: Internal placeholder
- **License**: N/A (temporary)
- **Modifications**: None
- **Date Added**: 2026-09-09
- **Used For**: Stairs sprite (48×48 teal/red rectangles)
- **TODO**: Replace with detailed stairs sprite (locked/unlocked states)

---

## Audio

### Music

**Status**: No music implemented yet
- **TODO**: Add atmospheric horror ambient tracks per floor

### Sound Effects

#### Jumpscare Sounds
**Status**: Placeholder (text placeholders in code)
- **Source**: N/A
- **License**: N/A
- **Date Added**: 2026-09-09
- **Used For**: Placeholder text ("!!! SCREAM !!!") for ambusher jumpscare
- **TODO**: Replace with actual scream sound effect (CC0 or custom)

#### Ambient Sounds
**Status**: Not implemented yet
- **TODO**: Add footsteps, breathing, environmental sounds, stalker audio cues

---

## UI Assets

### Fonts

#### Monospace Font
**Status**: Browser default
- **Source**: System monospace font
- **License**: System font (varies by OS)
- **Date Added**: 2026-09-09
- **Used For**: All in-game text (HUD, messages, popups)
- **TODO**: Replace with custom pixel font for consistent cross-platform rendering

### Icons

**Status**: Not implemented yet
- **TODO**: Create 16×16 icons for HP, battery, curse, key, etc.

### Lore Documents

**Status**: Not implemented yet
- **TODO**: Create high-resolution document backgrounds with story text

---

## External Assets Planned

### Priority 1 (Core Gameplay)

**Needed**:
- Player sprite (32×48, 4-direction walk cycle)
- Stalker sprite (48×64, 4-direction walk cycle)
- Floor/wall tilesets (32×32, multiple variants per floor)
- Container sprites (32×32, 4-6 variants)

**Sources to Check**:
- OpenGameArt.org (CC0 dungeon/horror tilesets)
- Kenney.nl (CC0 asset packs)
- itch.io (CC0 pixel art bundles)

### Priority 2 (Polish)

**Needed**:
- Ambusher jumpscare face (512×512 high-detail horror)
- Mimic transformation sprites (32×32 → 48×48 animated)
- Crawler sprite (32×32, skittering animation)
- Watcher sprite (32×48, glowing eyes)

**Recommendation**: Commission custom art for these unique enemies

### Priority 3 (Content Expansion)

**Needed**:
- Additional floor tile variants (cracked, grated, stained)
- Props and debris (16×16 to 64×64 various)
- Lore document illustrations (800×600)
- UI panels and menus

---

## Asset Submission Guidelines

If you'd like to contribute assets to Block 13:

1. **Check the Art Bible** (`docs/art-bible.md`) for specifications
2. **Match the style**: Late 16-bit / early 32-bit pixel art, dark horror aesthetic
3. **Use correct dimensions**: See art bible for size targets
4. **Provide source files**: PSD, Aseprite, or layered PNG
5. **Specify license**: CC0 preferred, CC-BY acceptable
6. **Submit via**: GitHub issue or pull request

**Format for Submissions**:
```markdown
## [Asset Name]
- **Type**: [Sprite / Tileset / UI / Audio]
- **Size/Duration**: [Dimensions or length]
- **License**: [CC0 / CC-BY / Custom]
- **Source Files**: [Link to download]
- **Preview**: [Image/video]
```

---

## License Summary

**Current Status**:
- All placeholder graphics: Temporary, will be replaced
- All code: [See LICENSE file in repository root]
- All final game assets: TBD (CC0 or custom commissioned)

**Goal**:
- Maximize CC0 usage for simplicity
- Commission custom art for unique elements
- Clear licensing for Web3/blockchain compatibility

---

## Changelog

**2026-09-09**:
- Initial ASSET_CREDITS.md created
- Documented all current placeholder assets
- Established credit format and submission guidelines

---

**End of Asset Credits**

For questions about specific assets or to submit new assets, refer to `docs/art-bible.md` or open a GitHub issue.
