# Ambusher Sprites

**World Sprite Size**: 32×48 pixels  
**Jumpscare Size**: 512×512 pixels (or larger)  
**Format**: PNG with transparency (world), PNG (jumpscare)  
**Anchor (world)**: Bottom-center (16, 48)  

## Visual Concept

The Ambusher is a jumpscare enemy with two distinct visual states:
1. **World sprite**: Barely visible, hiding in shadows
2. **Jumpscare face**: Full-screen horror close-up

## Required Assets

### World Sprite (Subtle)
- `ambusher_world_hidden.png` - Nearly invisible (used at 0 alpha)
- `ambusher_world_eyes.png` - Just glowing amber eyes visible (32×48)
- `ambusher_world_reveal.png` - Brief full reveal before jumpscare (32×48)

**Visual Details**:
- Dark hunched figure
- Glowing amber/yellow eyes (primary tell)
- Shadow/distortion effect
- Meant to be rendered at 0.15-0.25 alpha (very subtle)
- No walk animation (static, then vanishes)

### Jumpscare Face (High Detail)
- `ambusher_face_jumpscare.png` - 512×512 minimum (can be larger)

**Visual Details**:
- Full-screen horror face close-up
- Wide eyes, open mouth, teeth visible
- Organic horror (not human, not monster - uncanny)
- High contrast, dramatic shadows
- Should be genuinely frightening
- Can be more detailed than world sprites (this is the payoff)

## Animation Timing

### World Sprite
- **Hidden**: Static, invisible
- **Eyes glow**: 150-400ms warning (subtle pulse optional)
- **Reveal**: 1-2 frames only, then triggers jumpscare

### Jumpscare Sequence
- **Zoom in**: 150ms (face fills screen)
- **Hold**: 650ms (full impact)
- **Fade out**: 200ms

Total: ~1000ms

## Visual Direction

### World Sprite Mood
- Barely perceptible
- "Did I just see something?"
- Eyes in darkness
- Unsettling, not obvious

### Jumpscare Face Mood
- Sudden, shocking
- Detailed horror
- In-your-face terror
- Organic wrongness (flesh, teeth, eyes too many/too large)

## Color Palette

### World Sprite
- **Base**: Near-black (#0a0a0a to #1a1a1a)
- **Eyes**: Bright amber (#ffaa00 to #ffcc00) - only visible part
- **Outline**: Pure black shadow

### Jumpscare Face
- **Base**: Pale sickly skin (#c0b0a0, #a89878)
- **Shadows**: Deep blacks and purples (#000000, #1a0a1a)
- **Eyes**: Bright unnatural yellow/white (#ffff00, #ffffff)
- **Mouth/Interior**: Deep reds and blacks (#4a0000, #000000)
- **Teeth**: Off-white, yellowed (#e0d8c8)

## Reference Inspiration

**Jumpscare face influences** (for mood, not direct copying):
- *Amnesia: The Dark Descent* monster faces
- *Five Nights at Freddy's* jumpscares (sudden, filling screen)
- *PT* Lisa close-up
- Classic horror game "gotcha" moments

**Do NOT directly copy**. Use as mood/technique reference only.

## Placeholder Status

**Current**: 
- World sprite: Dark rectangle with amber circles for eyes
- Jumpscare: Generated graphics (black circle with amber eyes and red mouth)

**Priority**: HIGH - Core horror mechanic  
**TODO**: Commission custom jumpscare face (512×512+). This is a signature scare moment.

## Technical Notes

### World Sprite Usage
```typescript
// Rendered at very low alpha during warning
ambusherSprite.setAlpha(0.15); // Barely visible
ambusherSprite.setTexture('ambusher_world_eyes');
```

### Jumpscare Usage
```typescript
// Full-screen, high-depth rendering
jumpscareSprite.setScrollFactor(0);
jumpscareSprite.setDepth(300);
jumpscareSprite.setTexture('ambusher_face_jumpscare');
```

World sprite is world-space (player can move past it).  
Jumpscare face is UI-space (camera-locked, full-screen).
