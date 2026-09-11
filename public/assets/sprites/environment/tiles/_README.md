# Environment Tiles

**Size**: 32×32 pixels  
**Format**: PNG with transparency (if needed) or opaque PNG  
**Tile Grid**: 32×32 pixel-perfect alignment  

## Tile Categories

### Floor Tiles

Walkable surfaces. Should feel solid and grounded.

**Required Variants**:
- `floor_concrete_clean.png` - Clean concrete (Floor 4)
- `floor_concrete_cracked.png` - Cracked concrete (Floor 3)
- `floor_concrete_stained.png` - Stained/bloodied (Floor 2)
- `floor_grating.png` - Metal grating over darkness (Floor 2-1)
- `floor_corrupted.png` - Organic corruption (Floor 1, Block 13)
- `floor_tile_institutional.png` - Institutional flooring (Floor 4-3)

**Animation Optional**:
- Water puddles (2-4 frame ripple)
- Corruption pulse (2-4 frame throb)

### Wall Tiles

Impassable barriers. Should feel solid and oppressive.

**Required Variants**:
- `wall_cinderblock_clean.png` - Painted cinderblock (Floor 4)
- `wall_cinderblock_peeling.png` - Peeling paint (Floor 3)
- `wall_cinderblock_damaged.png` - Cracked, exposed (Floor 2)
- `wall_metal.png` - Industrial metal panels (Floor 2-1)
- `wall_rusted.png` - Heavily rusted metal (Floor 1)
- `wall_corrupted.png` - Organic growth (Floor 1, Block 13)

**Visual Details**:
- Clear top edge (defines where wall starts)
- Vertical face should have depth/texture
- Shadow at base (grounds the wall)

## Floor Progression

### Floor 4 (Clean/Recent)
- **Palette**: Grays (#808080, #606060), dim yellows (#a0a080)
- **Condition**: Mostly intact, minimal decay
- **Details**: Clean lines, institutional look

### Floor 3 (Decay)
- **Palette**: Darker grays (#505050, #404040), rust oranges (#8a5a3a)
- **Condition**: Peeling, cracking, water damage
- **Details**: Stains, cracks, exposed underlayers

### Floor 2 (Corruption)
- **Palette**: Deep shadows (#303030, #202020), sickly greens (#3a4a2a)
- **Condition**: Heavy damage, organic growth starting
- **Details**: Rust, corrosion, mold/growth

### Floor 1 (Nightmare)
- **Palette**: Near-black (#1a1a1a, #0a0a0a), blood reds (#4a0000), toxic purples (#3a1a3a)
- **Condition**: Severe corruption, warping
- **Details**: Organic masses, warped geometry, pulsing

### Block 13 (Finale)
- **Palette**: Void blacks (#000000), vivid reds (#8a0000), unnatural purples (#5a1a5a)
- **Condition**: Surreal, impossible
- **Details**: Reality breaks, non-Euclidean suggestion, maximum corruption

## Tiling Rules

**Seamless Edges**:
- Top edge must tile with bottom edge
- Left edge must tile with right edge
- Use pattern/texture that repeats naturally

**Variant Mixing**:
- Multiple variants of same type can be randomly placed
- Creates visual variety without breaking theme
- Example: 3-4 concrete floor variants mixed together

**Edge Transitions**:
- Consider creating half-tiles for smooth transitions
- Floor-to-grating transitions
- Clean-to-corrupted transitions

## Palette Per Floor

### Floor 4
```
#d0d0d0 - Light concrete
#909090 - Mid concrete
#606060 - Dark concrete
#404040 - Shadow
#a0a080 - Dim light yellow
```

### Floor 3
```
#808080 - Concrete base
#505050 - Darker concrete
#8a5a3a - Rust orange
#3a2a1a - Dark rust
#202020 - Deep shadow
```

### Floor 2
```
#606060 - Base gray
#404040 - Dark gray
#3a4a2a - Sickly green
#2a1a1a - Deep shadow
#1a1a0a - Organic dark
```

### Floor 1
```
#303030 - Dim gray
#1a1a1a - Near-black
#4a0000 - Blood red
#3a1a3a - Toxic purple
#000000 - Pure black
```

### Block 13
```
#0a0a0a - Void black
#8a0000 - Vivid red
#5a1a5a - Unnatural purple
#000000 - Pure black
#ffffff - Unnatural white (sparingly)
```

## Placeholder Status

**Current**: Solid color rectangles (gray for floor, dark gray for walls)  
**Priority**: HIGH - Core visual foundation  
**TODO**: Source CC0 tileset or commission floor-progressive sets

## CC0 Resource Recommendations

Check these sources for compatible tilesets:
- **Kenney.nl**: Dungeon tiles, industrial tiles
- **OpenGameArt.org**: Search "dungeon", "industrial", "pixel tileset"
- **itch.io**: Search "CC0 pixel tileset"

**Modification Expected**:
- Recolor to match floor progression palettes
- Add horror elements (stains, cracks, corruption)
- Darken significantly (game is very dark)

## Technical Notes

### Phaser Integration
```typescript
// Static tiles
this.load.image('floor_concrete', 'assets/sprites/environment/tiles/floor_concrete.png');

// Animated tiles (via Tiled)
{
  "animation": [
    {"tileid": 64, "duration": 250},
    {"tileid": 65, "duration": 250}
  ]
}
```

### Tilemap Layer Depth
- Floor tiles: Depth 0 (lowest)
- Floor details (stains, etc.): Depth 1
- Walls: Depth 10
- Wall details: Depth 11
