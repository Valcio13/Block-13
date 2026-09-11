# Player Sprites

**Size**: 32×48 pixels  
**Format**: PNG with transparency  
**Anchor**: Bottom-center (16, 48)  

## Required Assets

### Idle Animation
- `player_idle_down.png` - Facing down (1 frame or 2-frame breathing)
- `player_idle_up.png` - Facing up
- `player_idle_left.png` - Facing left
- `player_idle_right.png` - Facing right

### Walk Cycle
- `player_walk_down_sheet.png` - 4 frames, horizontal layout (128×48)
- `player_walk_up_sheet.png` - 4 frames, horizontal layout (128×48)
- `player_walk_left_sheet.png` - 4 frames, horizontal layout (128×48)
- `player_walk_right_sheet.png` - 4 frames, horizontal layout (128×48)

### Interaction
- `player_search.png` - Bending down/reaching animation (2-3 frames)

## Animation Timing

- **Idle**: 200ms per frame (5 FPS) if animated, static if single frame
- **Walk**: 100ms per frame (10 FPS)
- **Search**: 150ms per frame (6 FPS)

## Visual Direction

- Average build humanoid
- Slightly hunched posture (tension/fear)
- Flashlight held in hand (visible in sprite)
- Simple clothing (shirt, pants)
- Minimal facial detail (player projection)

## Placeholder Status

**Current**: Colored rectangle (blue, 32×48)  
**Priority**: HIGH - Core gameplay sprite  
**TODO**: Commission or find CC0 horror game character sprite
