# Block 13 Art Bible

## Overview

Block 13 is a **dark 2D top-down survival-horror pixel art game** with a late-16-bit / early-32-bit aesthetic. The visual style emphasizes atmospheric dread, claustrophobia, and gradual descent into nightmare territory.

**Core Aesthetic**: Silent Hill meets classic Resident Evil meets 16-bit dungeon crawlers  
**Technical Foundation**: 32×32 world tile baseline  
**Color Philosophy**: Desaturated, high-contrast, oppressive darkness with strategic accent colors  

---

## Visual Direction

### Art Style

**Era Reference**: Late SNES / Early PlayStation (1994-1998)
- Detailed pixel art with moderate color counts
- Dithering for texture and shadow gradients
- Limited animation frames (4-8 per cycle)
- Strategic use of transparency and overlay effects

**Tone**:
- **Oppressive darkness**: Most environments are dimly lit
- **Industrial decay**: Rusted metal, cracked concrete, flickering lights
- **Organic corruption**: Growth, stains, warping geometry
- **Institutional horror**: Sterile gone wrong, abandoned infrastructure

**Visual Hierarchy**:
1. Player flashlight cone (highest visibility)
2. Interactive objects (subtle highlight/glow)
3. Enemies (visible but blending with environment)
4. Environment (dark, textured, atmospheric)

### Palette Guidance

**Base Palette** (per floor - see Environment Progression below):
- 16-24 core colors per tileset
- Dark grays and blacks dominate
- Limited use of saturated colors for emphasis

**Strategic Color Usage**:
- **Amber/Yellow**: Player flashlight, key items, warnings
- **Red**: Danger, health loss, blood, critical alerts
- **Cyan/Teal**: Unlocked elements, battery, safe zones
- **Purple/Violet**: Curse buildup, supernatural elements
- **Green**: Healing items, health UI
- **White**: Text, UI elements, extreme highlights

**Contrast Rules**:
- Background: Dark (10-30% brightness)
- Midground: Medium-dark (20-50% brightness)
- Foreground/Interactive: Medium-light (40-70% brightness)
- Highlights: Bright (70-100% brightness, used sparingly)

---

## Native Asset Targets

### World / Environment

| Asset Type | Size | Notes |
|------------|------|-------|
| Floor tiles | 32×32 | Concrete, grating, tile, pools |
| Wall tiles | 32×32 | Solid walls, damaged sections |
| Door sprites | 32×48 | Closed, open, locked states |
| Props (small) | 16×16 | Debris, small items |
| Props (medium) | 32×32 | Furniture, machinery |
| Props (large) | 32×48, 48×48, 64×64 | Large equipment, structures |
| Containers | 32×32 | Boxes, crates, lockers, cabinets |

### Characters & Enemies

| Entity | Size | Animations | Notes |
|--------|------|------------|-------|
| Player | 32×48 | Idle (1), Walk (4), Search (2) | 4-direction |
| Crawler | 32×32 | Crawl (4), Lunge (2) | Low profile, spider-like |
| Watcher | 32×48 | Idle (2), Stare (1) | Tall, unmoving, eyes glow |
| Stalker | 48×64 | Walk (4), Chase (4) | Large, imposing, hunched |
| Mimic | 32×32 → 48×48 | Closed (1), Opening (3), Open (1), Transform (4) | Starts as container |
| Ambusher | 32×48 | Hidden (1), Eyes (2), Reveal (2) | Subtle world sprite |

**Animation Conventions**:
- **4-direction movement**: Down, Up, Left, Right (in that sprite sheet order)
- **Idle**: 1-2 frames, subtle breathing/sway
- **Walk cycle**: 4 frames per direction (16 frames total)
- **Attack/Special**: 2-4 frames, snappy timing
- **Framerate**: 8-12 FPS for walk cycles, variable for special actions

### Items & Pickups

| Item Type | Size | Notes |
|-----------|------|-------|
| Small pickups | 16×16 | Batteries, small med kits |
| Medium pickups | 24×24 | Keys, documents, tools |
| Large pickups | 32×32 | Major items (rare) |

**Pickup Design**:
- Clear silhouette at small size
- Subtle idle animation (bob, glow, rotate)
- Color-coded by type (green = health, cyan = battery, gold = key)

### UI & Jumpscare Assets

| Asset Type | Size | Notes |
|------------|------|-------|
| Jumpscare close-ups | 512×512+ | High detail, full-screen face horror |
| Lore documents | 800×600+ | Readable text, aged paper, handwriting |
| UI panels | Variable | HUD, menus, popups - clean pixel art |
| Icons | 16×16, 24×24 | Inventory, status effects, minimap |

---

## Character & Enemy Visual Direction

### Player Character

**Silhouette**: Humanoid, average build, slightly hunched (fear/exhaustion)
**Details**:
- Flashlight held in hand (visible light source)
- Simple clothing (shirt, pants, practical)
- Minimal facial detail (player projection)
- Body language conveys tension

**Animation Priority**:
1. 4-direction walk cycle (primary gameplay)
2. Idle breathing (subtle life)
3. Search/interact animation (bend down, reach)

### Crawler

**Concept**: Low-profile ambush predator, spider/insect-like
**Silhouette**: Wide, flat, skittering
**Details**:
- Multiple limbs visible
- Dark chitinous body
- Pale eyes or bioluminescence
- Low to ground, moves erratically

**Animation Priority**:
1. Crawl cycle (fast, jittery)
2. Lunge attack (sudden spring)
3. Idle twitch (creepy stillness)

### Watcher

**Concept**: Tall, statue-like observer that curses the player
**Silhouette**: Elongated humanoid, unnaturally still
**Details**:
- Very tall (48 pixels high)
- Featureless except for eyes
- Eyes glow amber/yellow when active
- No walk animation (teleports/appears)

**Animation Priority**:
1. Idle stare (eyes glow intensifies)
2. Blink or eye-open (rare, unsettling)
3. Subtle sway (barely perceptible)

### Stalker

**Concept**: Primary pursuit enemy, relentless hunter
**Silhouette**: Large, hunched, powerful build
**Details**:
- 48×64 (largest enemy sprite)
- Heavy, lumbering silhouette
- Long arms, dragging posture
- Minimal facial features (shadow, outline)
- Heavier breathing/footstep sounds implied

**Animation Priority**:
1. Walk cycle (slow, heavy)
2. Chase cycle (faster, aggressive)
3. Idle turn/search (looking for player)

### Mimic

**Concept**: Container that transforms into a monster
**Silhouette**: Starts identical to searchable container, then unfolds/warps
**Details**:
- **Closed**: Perfect container replica (32×32)
- **Opening**: Lid cracks, tendrils/teeth emerge (2-3 frames)
- **Transformed**: Monstrous form, organic horror (48×48)
- Teeth, eyes, grasping limbs visible in open state

**Animation Priority**:
1. Idle closed (subtle breathing? optional)
2. Opening sequence (reveal horror)
3. Transformed chase (lurching movement)

### Ambusher

**Concept**: Hidden jumpscare enemy, barely visible until trigger
**Silhouette**: Humanoid but wrong, hunched in shadows
**Details**:
- **World sprite** (32×48): Dark mass, barely visible (alpha 0.15-0.25)
- Glowing amber eyes (primary tell)
- Shadow/distortion effect around it
- No walk cycle (hidden, then vanishes)

**Animation Priority**:
1. Hidden eyes glow (warning state)
2. Brief reveal (1-2 frames before jumpscare)

**Jumpscare Asset** (512×512+):
- Full-screen face close-up
- High detail horror face
- Wide eyes, open mouth/teeth
- Organic horror, not human
- High contrast, dramatic shadows

---

## Environment Progression

Each floor should feel distinct, with visual escalation of horror and decay.

### Floor 4 (Tutorial / Surface Level)

**Theme**: Institutional basement, recently abandoned  
**Palette**: Gray concrete, dim yellows, muted blues  
**Lighting**: Weak overhead fluorescents, some functional  
**Condition**: Mostly intact, minor decay  

**Visual Elements**:
- Clean-ish concrete floors
- Painted cinderblock walls
- Intact furniture and equipment
- Working lights (some flicker)
- Minimal blood or organic growth
- Signage still readable

**Mood**: Unsettling but navigable, "something is wrong but recent"

### Floor 3 (Descent)

**Theme**: Deeper facility, maintenance areas  
**Palette**: Darker grays, rust oranges, dull greens  
**Lighting**: Many lights broken, shadows deeper  
**Condition**: Noticeable decay, water damage  

**Visual Elements**:
- Cracked floors, puddles
- Peeling paint, exposed pipes
- Broken furniture, scattered debris
- Rust stains, water damage
- Graffiti or scratch marks
- Emergency lighting only

**Mood**: "This place has been abandoned for a while"

### Floor 2 (Corruption)

**Theme**: Industrial depths, active decay  
**Palette**: Deep shadows, sickly greens, dirty reds  
**Lighting**: Sparse emergency lights, mostly darkness  
**Condition**: Heavy damage, organic intrusion  

**Visual Elements**:
- Grated floors over darkness
- Exposed rebar, structural damage
- Heavy rust, corrosion
- Organic growth (mold, vines, stains)
- Blood stains, drag marks
- Machinery in disrepair

**Mood**: "Something happened here, danger is present"

### Floor 1 (Nightmare)

**Theme**: Deep facility, hostile environment  
**Palette**: Near-black, blood reds, toxic purples  
**Lighting**: Minimal, flickering, hostile  
**Condition**: Severe corruption, actively wrong  

**Visual Elements**:
- Warped geometry (walls not quite right)
- Heavy organic corruption (flesh-like growths)
- Blood and viscera
- Pulsing textures (animated corruption)
- Broken reality (spatial impossibilities)
- Hostile environment (spikes, hazards)

**Mood**: "This isn't just abandoned, it's alive and hostile"

### Block 13 (The Finale)

**Theme**: Impossible space, pure nightmare  
**Palette**: Void blacks, vivid reds, unnatural purples  
**Lighting**: Unnatural (glows from wrong sources)  
**Condition**: Beyond decay - surreal horror  

**Visual Elements**:
- Non-Euclidean layouts (visually suggested)
- Organic and mechanical fused
- Pulsing walls (breathing environment)
- Reality breaks (floating objects, inverted gravity visuals)
- Maximum corruption
- Central objective area (ritual site, core, etc.)

**Mood**: "This is the source, the heart of wrongness"

---

## Sprite Scaling & Resolution Rules

### Baseline Resolution

**World Scale**: 32×32 pixels = 1 gameplay tile  
**Camera View**: 1280×720 base resolution (40×22.5 tiles visible)  
**Pixel-perfect rendering**: Assets should align to pixel grid  

### Scaling Rules

**DO**:
- Design assets at native resolution (32×32 baseline)
- Use integer scaling for upscaling (2×, 3×, 4×)
- Export sprites with transparency (PNG)
- Include padding/margins for sprite sheets (1-2px between frames)

**DON'T**:
- Use non-integer scaling (causes blur/artifacts)
- Mix resolutions within a category (all walls 32×32, etc.)
- Export with compression artifacts (use lossless PNG)
- Forget to center sprites on their anchor points

### Animation Frame Timing

**Walk Cycles**: 100-125ms per frame (8-10 FPS)  
**Idle Animations**: 200-300ms per frame (3-5 FPS)  
**Attack/Special**: 80-150ms per frame (6-12 FPS)  
**Jumpscares**: 50-100ms per frame (10-20 FPS)  

---

## Asset Sourcing Strategy

### Philosophy

Block 13 prioritizes **rapid prototyping and iteration** over perfection. Assets will be sourced through a hybrid approach:

1. **CC0/Public Domain assets** (preferred for early development)
2. **Commissioned/custom art** (for unique elements and polish)
3. **AI-generated placeholders** (temporary, clearly marked)
4. **Open-source contributions** (community involvement)

### CC0 External Asset Preference

**Why CC0**:
- No attribution required in game UI
- Commercial use permitted
- Can be modified freely
- Simplifies licensing for Web3/blockchain integration

**Acceptable CC0 Sources**:
- OpenGameArt.org (CC0 tagged)
- itch.io (CC0 asset packs)
- Kenney.nl (all assets CC0)
- Public domain sprite archives

**Process**:
1. Search for CC0 assets matching art bible specs
2. Test in-game for fit and quality
3. Modify as needed (recolor, resize, edit)
4. Record in ASSET_CREDITS.md with source URL

### Custom Asset Workflow

**When to Commission**:
- Unique enemy designs (stalker, watcher, mimic)
- Jumpscare close-ups (high detail required)
- Key narrative assets (lore documents)
- Player character (central to experience)

**Commission Specifications**:
- Provide this art bible as reference
- Supply exact pixel dimensions
- Request layered files (PSD/Aseprite)
- Specify animation frame counts
- Request CC0 or perpetual commercial license

### Generated Asset Guidelines

**Temporary Use Only**:
- AI-generated sprites are placeholders
- Must be replaced before final release
- Clearly marked in code comments and ASSET_CREDITS.md

**Generation Prompts Should Include**:
- "pixel art, 32x32, top-down view, dark horror"
- Reference this art bible's palette and style
- Specify era (late 16-bit / early 32-bit)

**Post-Processing Required**:
- Manual cleanup (remove artifacts)
- Palette correction (match art bible)
- Resize/crop to exact specifications
- Add transparency where needed

---

## Asset Organization

### Folder Structure

```
public/assets/
├── sprites/
│   ├── player/
│   │   ├── player_idle_down.png
│   │   ├── player_walk_down.png
│   │   ├── player_walk_up.png
│   │   ├── player_walk_left.png
│   │   ├── player_walk_right.png
│   │   └── player_search.png
│   ├── enemies/
│   │   ├── crawler/
│   │   │   ├── crawler_crawl.png (sprite sheet: 4 frames × 4 directions)
│   │   │   └── crawler_lunge.png (sprite sheet: 2 frames)
│   │   ├── watcher/
│   │   │   ├── watcher_idle.png
│   │   │   └── watcher_stare.png
│   │   ├── stalker/
│   │   │   ├── stalker_walk.png (sprite sheet: 4 frames × 4 directions)
│   │   │   └── stalker_chase.png (sprite sheet: 4 frames × 4 directions)
│   │   ├── mimic/
│   │   │   ├── mimic_closed.png
│   │   │   ├── mimic_opening.png (sprite sheet: 3 frames)
│   │   │   └── mimic_open.png
│   │   └── ambusher/
│   │       ├── ambusher_world.png (32×48, subtle)
│   │       └── ambusher_face_jumpscare.png (512×512)
│   ├── environment/
│   │   ├── tiles/
│   │   │   ├── floor_concrete_clean.png (32×32)
│   │   │   ├── floor_concrete_cracked.png (32×32)
│   │   │   ├── floor_grating.png (32×32)
│   │   │   ├── wall_cinderblock.png (32×32)
│   │   │   ├── wall_damaged.png (32×32)
│   │   │   └── wall_corrupted.png (32×32)
│   │   ├── props/
│   │   │   ├── debris_small.png (16×16)
│   │   │   ├── furniture_chair.png (32×32)
│   │   │   ├── machinery_large.png (64×64)
│   │   │   └── ...
│   │   ├── doors/
│   │   │   ├── door_closed.png (32×48)
│   │   │   ├── door_open.png (32×48)
│   │   │   └── door_locked.png (32×48)
│   │   └── containers/
│   │       ├── box_wooden.png (32×32)
│   │       ├── crate_metal.png (32×32)
│   │       ├── locker.png (32×48)
│   │       └── cabinet.png (32×32)
│   ├── items/
│   │   ├── key_gold.png (24×24)
│   │   ├── battery.png (16×16)
│   │   ├── medkit_small.png (16×16)
│   │   ├── medkit_large.png (24×24)
│   │   └── document.png (24×24)
│   └── effects/
│       ├── flashlight_cone.png (gradient mask)
│       ├── blood_splatter.png (32×32)
│       ├── glitch_overlay.png (screen-size)
│       └── corruption_growth.png (animated, 32×32)
├── ui/
│   ├── hud_frame.png
│   ├── icons/
│   │   ├── icon_hp.png (16×16)
│   │   ├── icon_battery.png (16×16)
│   │   ├── icon_curse.png (16×16)
│   │   └── icon_key.png (16×16)
│   ├── lore/
│   │   ├── document_01.png (800×600)
│   │   ├── document_02.png (800×600)
│   │   └── ...
│   └── menus/
│       ├── title_logo.png
│       ├── button_normal.png
│       ├── button_hover.png
│       └── ...
└── audio/
    ├── ambience/
    ├── sfx/
    └── music/
```

### Naming Conventions

**Format**: `category_descriptor_variant.png`

**Examples**:
- `player_walk_down.png` (category: player, descriptor: walk, variant: down)
- `floor_concrete_cracked.png` (category: floor, descriptor: concrete, variant: cracked)
- `stalker_chase_right.png` (category: stalker, descriptor: chase, variant: right)

**Sprite Sheets**:
- Horizontal layout (frames left to right)
- For multi-direction: Top to bottom = Down, Up, Left, Right
- Filename indicates it's a sheet: `crawler_crawl_sheet.png`

### Metadata Files

Each asset folder should contain:

**`_README.md`**:
- Purpose of assets in this folder
- Specifications (size, format, animation frames)
- Special notes (anchor points, transparency, etc.)

**Example** (`sprites/enemies/stalker/_README.md`):
```markdown
# Stalker Sprites

**Size**: 48×64 pixels
**Format**: PNG with transparency
**Anchor**: Bottom-center (24, 64)

## Files
- `stalker_walk_sheet.png`: 4 frames × 4 directions (16 frames total, 768×256)
- `stalker_chase_sheet.png`: 4 frames × 4 directions (16 frames total, 768×256)

## Animation Timing
- Walk: 125ms per frame (8 FPS)
- Chase: 100ms per frame (10 FPS)
```

---

## ASSET_CREDITS.md Requirements

All external assets MUST be recorded in `ASSET_CREDITS.md` at the repository root.

**Required Information**:
1. Asset name/description
2. Source (creator/website)
3. License (CC0, CC-BY, custom, etc.)
4. URL to original
5. Modifications (if any)
6. Date added

**Template**:
```markdown
## [Asset Name]
- **Source**: [Creator Name]
- **URL**: [Direct link to asset page]
- **License**: [CC0 / CC-BY / etc.]
- **Modifications**: [None / Recolored / Resized / etc.]
- **Date Added**: YYYY-MM-DD
- **Used For**: [In-game usage description]
```

**Example**:
```markdown
## Dungeon Tileset Base
- **Source**: Kenney.nl
- **URL**: https://kenney.nl/assets/dungeon-tiles
- **License**: CC0 (Public Domain)
- **Modifications**: Recolored to match Block 13 palette, added rust overlays
- **Date Added**: 2026-09-09
- **Used For**: Floor 4 and Floor 3 base tiles
```

---

## Integration Checklist

When adding new art assets:

- [ ] Asset matches native size specifications
- [ ] Palette matches floor/category guidelines
- [ ] File naming follows conventions
- [ ] Transparency is correct (PNG with alpha)
- [ ] Sprite sheet layout matches standards (if applicable)
- [ ] Anchor point is documented
- [ ] Asset is placed in correct folder
- [ ] `_README.md` is updated in asset folder
- [ ] `ASSET_CREDITS.md` is updated (if external asset)
- [ ] Asset is referenced in code/scene loader
- [ ] In-game test confirms visual quality
- [ ] Performance impact is acceptable

---

## Future Expansion

### Planned Asset Categories

**Not Yet Implemented**:
- Boss enemies (large sprite, multi-phase)
- Environmental hazards (animated traps)
- Weather/particle effects (dust, fog, rain)
- Cutscene illustrations (high-res, cinematic moments)
- Additional floor variations (more tile variety)
- Alternate player skins (unlockables)

**Web3-Specific**:
- NFT character skins (custom player sprites)
- Community-designed enemies (voting/submission system)
- Procedural generation overlays (on-chain influenced palettes)

### Asset Pipeline Roadmap

**Phase 1** (Current - Prototyping):
- Placeholder graphics (colored rectangles, basic shapes)
- CC0 assets for rapid testing
- Focus on gameplay over visuals

**Phase 2** (Alpha - Establishing Style):
- Commission core sprites (player, stalker, mimic)
- Replace placeholders with art bible-compliant assets
- Implement jumpscare close-ups
- Create base tilesets for all floors

**Phase 3** (Beta - Polish):
- Full animation sets for all entities
- Environmental detail passes (props, debris, atmosphere)
- Lore document illustrations
- UI/menu art finalization

**Phase 4** (Release - Community):
- Open asset submission system
- Implement NFT skin support
- Community-voted additions
- Ongoing content packs

---

## Technical Notes

### Phaser 3 Integration

**Loading Assets**:
```typescript
this.load.image('floor_concrete', 'assets/sprites/environment/tiles/floor_concrete.png');
this.load.spritesheet('player_walk', 'assets/sprites/player/player_walk_sheet.png', {
  frameWidth: 32,
  frameHeight: 48
});
```

**Sprite Anchor Points**:
- Use `setOrigin(0.5, 1.0)` for bottom-center anchor (characters)
- Use `setOrigin(0.5, 0.5)` for center anchor (tiles, props)

**Scaling**:
```typescript
// For native rendering
this.sys.game.scale.setGameSize(1280, 720);
this.sys.game.scale.setZoom(1); // 1:1 pixel ratio

// For 2× upscaling
this.sys.game.scale.setZoom(2);
```

### Performance Considerations

**Sprite Sheet vs Individual Files**:
- Use sprite sheets for animations (reduce draw calls)
- Use individual files for static/rare assets
- Max sprite sheet size: 2048×2048 (mobile compatibility)

**Transparency**:
- Use 8-bit alpha (not 1-bit) for smooth edges
- Trim transparent padding to reduce memory
- Use texture atlases for many small sprites

**Tilemap Optimization**:
- Use Tiled TMX format for large maps
- Layer tiles by depth (background, midground, foreground)
- Cull off-screen tiles automatically

---

## Questions & Clarifications

**Q: Can we use non-pixel art for UI elements?**  
A: Lore documents and some UI overlays can be higher-fidelity, but maintain the retro aesthetic. Jumpscare close-ups are intentionally high-detail for contrast.

**Q: What if we can't find CC0 assets that match?**  
A: Use CC-BY if necessary (credit in ASSET_CREDITS.md), or create placeholders and commission later.

**Q: Can we animate tiles (water, corruption, etc.)?**  
A: Yes! Use animated tiles (Phaser supports this via Tiled). Keep frame count low (2-4 frames) for performance.

**Q: How do we handle different screen resolutions?**  
A: Game renders at 1280×720 natively, then scales up using integer scaling. UI should be resolution-independent.

**Q: Are there any restricted visual elements?**  
A: Avoid overly graphic gore (game is horror, not torture porn). No explicit sexual content. No real-world hate symbols.

---

## Changelog

**2026-09-09**: Initial art bible created
- Established 32×32 baseline, late-16-bit aesthetic
- Defined native asset targets for all entity types
- Documented floor progression visual themes
- Created CC0 preference and asset credit requirements

---

**End of Art Bible**

For asset submissions or questions, refer to this document and check `ASSET_CREDITS.md` for existing assets.
