# Enemy Sprites

All enemy sprites follow the art bible specifications. Each enemy has its own subdirectory with specific requirements.

## Enemy Overview

| Enemy | Size | Priority | Unique Features |
|-------|------|----------|-----------------|
| Crawler | 32×32 | Medium | Low profile, skittering movement |
| Watcher | 32×48 | Medium | Tall, static, glowing eyes |
| Stalker | 48×64 | HIGH | Large, pursuit enemy, 4-direction |
| Mimic | 32×32 → 48×48 | HIGH | Transforms from container |
| Ambusher | 32×48 + 512×512 | HIGH | World sprite + jumpscare face |

## Animation Standards

**4-Direction Movement**:
- Sprite sheet layout: Top to bottom = Down, Up, Left, Right
- Each row: 4 frames of animation, left to right
- Total: 16 frames per sheet (4 frames × 4 directions)

**Special Animations**:
- Stored as separate sprite sheets
- Documented in each enemy's subdirectory README

## Visual Style

- Dark pixel art, late 16-bit aesthetic
- High contrast against environment
- Visible but blending (not cartoony)
- Organic horror elements where appropriate
- Minimal but readable details at 32px scale

## Placeholder Status

All enemies currently use colored rectangle placeholders. See individual subdirectories for specific replacement needs.
