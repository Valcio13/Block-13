# Stalker Sprites

**Size**: 48×64 pixels (largest enemy)  
**Format**: PNG with transparency  
**Anchor**: Bottom-center (24, 64)  

## Visual Concept

The Stalker is the primary pursuit enemy - large, imposing, relentless.

**Silhouette**: Large, hunched, powerful build  
**Details**:
- Heavy lumbering posture
- Long arms, dragging gait
- Minimal facial features (shadow, outline only)
- Dark, threatening presence
- Larger than player (intimidating)

## Required Assets

### Walk Cycle (Slow Patrol)
- `stalker_walk_sheet.png` - 4 frames × 4 directions (192×256 total)
- Frame layout: 4 frames horizontal × 4 directions vertical
- Slow, heavy footsteps implied

### Chase Cycle (Aggressive Pursuit)
- `stalker_chase_sheet.png` - 4 frames × 4 directions (192×256 total)
- Faster animation, more aggressive posture
- Lunging forward motion

## Animation Timing

- **Walk**: 125ms per frame (8 FPS) - slow and heavy
- **Chase**: 100ms per frame (10 FPS) - faster but still heavy

## Visual Direction

**Mood**: Inevitable, unstoppable, intimidating  
**Inspiration**: Pyramid Head (Silent Hill), Nemesis (Resident Evil), but original design  
**Key Features**:
- Hunched but tall (uses full 64px height)
- Long reach (emphasize arms)
- Minimal detail but clear silhouette
- Dark palette with subtle highlights

## Color Palette Suggestion

- **Base**: Dark grays, near-black (#1a1a1a to #404040)
- **Highlights**: Dim reflected light (#606060 to #808080)
- **Eyes/Details**: Optional amber glow (#ffaa00) - very subtle
- **Shadow**: Pure black outlines

## Placeholder Status

**Current**: Red rectangle (48×64)  
**Priority**: HIGH - Core horror antagonist  
**TODO**: Commission custom pixel art - this is a unique, signature enemy
