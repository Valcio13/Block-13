# Block 13 Assets

This directory contains all game assets: sprites, audio, UI elements, and more.

## Directory Structure

```
assets/
├── sprites/
│   ├── player/          - Player character sprites
│   ├── enemies/         - All enemy sprites (crawler, watcher, stalker, mimic, ambusher)
│   ├── environment/     - Tiles, props, doors, containers
│   ├── items/           - Pickups (keys, batteries, health)
│   └── effects/         - Visual effects (flashlight, blood, glitch)
├── ui/
│   ├── icons/           - HUD icons (16×16, 24×24)
│   ├── lore/            - Lore document images (high-res)
│   └── menus/           - Menu backgrounds, buttons
└── audio/
    ├── ambience/        - Ambient background sounds
    ├── sfx/             - Sound effects
    └── music/           - Music tracks (if any)
```

## Asset Standards

**Reference**: See `docs/art-bible.md` for complete specifications

**Quick Reference**:
- **Base tile size**: 32×32 pixels
- **Art style**: Late 16-bit / early 32-bit pixel art
- **Theme**: Dark survival-horror
- **Format**: PNG (with alpha transparency where needed)
- **Naming**: `category_descriptor_variant.png`

## Current Status

**All assets are currently placeholders** (colored rectangles, generated graphics).

Priority replacement order:
1. **HIGH**: Player, stalker, ambusher jumpscare face, floor/wall tiles
2. **MEDIUM**: Mimic, crawler, watcher, containers
3. **LOW**: Props, effects, UI polish

## Asset Credits

**All external assets must be documented in `/ASSET_CREDITS.md`**

See that file for:
- Current asset sources
- License information
- Attribution requirements
- Submission guidelines

## Finding Assets

### Recommended CC0 Sources
- **Kenney.nl**: High-quality CC0 game assets
- **OpenGameArt.org**: Large CC0 collection
- **itch.io**: Many CC0 asset packs

### Search Tips
- Search terms: "pixel art", "dungeon", "horror", "top-down", "32x32"
- Filter by license: CC0 (Public Domain)
- Check art style matches late 16-bit aesthetic
- Verify dimensions match requirements

## Modifying External Assets

External assets will need modifications to match Block 13's aesthetic:

**Common Modifications**:
1. **Recolor**: Match floor-specific palettes
2. **Darken**: Game is much darker than typical dungeon crawlers
3. **Add horror elements**: Blood, rust, corruption overlays
4. **Resize**: Ensure exact 32×32 baseline
5. **Add shadows**: Increase depth and atmosphere

## Submission Guidelines

Contributing assets? Great!

**Requirements**:
1. Match art bible specifications (see `docs/art-bible.md`)
2. Provide source files (PSD, Aseprite, layered PNG)
3. Specify license (CC0 preferred)
4. Include preview image
5. Document in ASSET_CREDITS.md

**Submit via**:
- GitHub pull request (preferred)
- GitHub issue with download link

## Technical Integration

### Loading in Phaser

**Static images**:
```typescript
this.load.image('asset_name', 'assets/sprites/category/asset_name.png');
```

**Sprite sheets**:
```typescript
this.load.spritesheet('asset_name', 'assets/sprites/category/asset_name_sheet.png', {
  frameWidth: 32,
  frameHeight: 48
});
```

**Audio**:
```typescript
this.load.audio('sound_name', 'assets/audio/sfx/sound_name.mp3');
```

### Asset Preloading

All assets should be preloaded in `BootScene` or `LoadingScene` before gameplay starts.

## Performance Notes

**Optimization Tips**:
- Use sprite sheets for animations (reduces draw calls)
- Keep individual sprite sheets under 2048×2048 (mobile compatibility)
- Use texture atlases for many small sprites
- Compress audio appropriately (MP3 for music, OGG for SFX)
- Cull off-screen sprites and tiles

## Questions?

- **Art direction**: See `docs/art-bible.md`
- **Asset credits**: See `/ASSET_CREDITS.md`
- **Technical specs**: See individual `_README.md` files in subdirectories
- **Issues**: Open a GitHub issue

---

**Last Updated**: 2026-09-09  
**Status**: All placeholders, seeking external CC0 assets and commissioning custom art
