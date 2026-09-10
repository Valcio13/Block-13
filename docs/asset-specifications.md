# Block 13 Asset Specifications

## Canvas Resolution
- **Game Resolution**: 1280×720 (16:9 aspect ratio)
- **Scale Mode**: Phaser.Scale.FIT with CENTER_BOTH
- **Rendering**: antialias: true, roundPixels: true, pixelArt: false

## Camera Configuration
- **World Zoom**: 1.5× (closer gameplay view)
- **Visible Area**: ~853×480 world units at 1.5× zoom
- **Camera follows player** with smooth lerp

## Recommended Asset Dimensions

### Player Character
- **Native Size**: 32×32 pixels
- **Display Size**: 48×48 pixels (1.5× zoom)
- **Collision Box**: 24×24 pixels (centered)
- **Format**: Sprite sheet for animations

### Enemies
- **Stalker**: 32×32 pixels native, 48×48 display
- **Secondary Enemies**: 24×24 pixels native, 36×36 display
- **Mimics**: Match box size (32×32 native)
- **Collision**: Slightly smaller than visual sprite

### Environment Objects
- **Wall Tiles**: 32×32 pixels (standard grid)
- **Floor Tiles**: 32×32 pixels
- **Boxes**: 32×32 pixels native
  - Standard: brown/gray
  - Mimic: slightly different tape pattern
- **Exit Stairs**: 64×64 pixels (2×2 tiles)

### Collectibles
- **Battery Pickups**: 16×16 pixels native, 24×24 display
- **Health Pickups**: 16×16 pixels native, 24×24 display
- **Story Notes**: 24×24 pixels native (glow effect added in-engine)

### UI Elements
- **HUD Text**: 14px monospace font
- **Health Bar**: 300×20 pixels at camera resolution
- **Battery Indicator**: Text-based (no sprite needed)
- **Story Cards**: 500×250 pixels (UI space, not world)

### Lighting & Effects
- **Flashlight Sprite**: 16×16 pixels (player-attached)
- **Light Cone**: Generated via Phaser graphics (not sprite)
- **Particle Effects**: 4×4 to 8×8 pixels for dust/corruption

## Pixel Art Guidelines

### Scale Factors
- Use **integer scale multiples** when possible
- Base grid: 16×16 pixels
- Common sizes: 16, 24, 32, 48, 64 pixels
- Avoid non-integer scaling (e.g., 33×33)

### Color Palette
- **Background**: #07090d (dark blue-black)
- **Walls**: Dark gray (#1a1a1a to #2a2a2a)
- **Player/Items**: Cyan-green accent (#70d4c6, #d9f3ea)
- **Danger**: Red accent (#ff4444)
- **Mimic Eyes**: Glowing yellow/red

### Rendering Notes
- Assets render with **antialiasing enabled** for smooth edges
- Camera uses **roundPixels: true** to prevent sub-pixel jitter
- Avoid dithering patterns smaller than 2×2 pixels (may blur)
- High-contrast edges work best at current resolution

## Future Expansion

If higher resolution needed:
- **1920×1080**: Scale all assets by 1.5× (48px base becomes 72px)
- **2560×1440**: Scale all assets by 2× (48px base becomes 96px)
- Maintain integer scale ratios for crispness

## File Organization
```
assets/
  sprites/
    player/
      player-idle.png
      player-walk.png
    enemies/
      stalker.png
      secondary-enemy.png
    environment/
      wall-tile.png
      floor-tile.png
      box.png
      exit.png
    collectibles/
      battery.png
      health.png
      note-glow.png
```

## Current Placeholder Assets
All current game objects use **Phaser graphics primitives**:
- Rectangles with fill colors
- Text labels for debugging
- Generated light cones

These should be replaced with proper pixel art sprites following the specifications above.

---

**Note**: Current game resolution increased from 800×600 to 1280×720 for crisp rendering on modern displays. Scale.FIT ensures proper letterboxing on non-16:9 screens.
