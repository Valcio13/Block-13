# Block 13

An onchain 2D top-down survival-horror game built for the Hemi Arcade Contest 2: Turbo Edition.

## Overview

Block 13 is a blockchain-based survival horror experience where players navigate through procedurally generated floors while being hunted by intelligent AI enemies. Trapped in a corrupted building, you must descend three cursed floors to reach the emergency exit. Each run is deterministic based on a blockchain seed, ensuring fairness and verifiable replayability.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Game Engine**: Phaser 3
- **Blockchain**: Hemi Network (EVM-compatible)
- **Web3**: Wagmi + Viem + TanStack Query
- **Smart Contract**: Solidity

## Run Flow

1. `startRun()` creates a seeded run on Hemi
2. Player clears three descending floors locally in browser
3. `submitScore()` records the completed run on-chain

No transactions occur during gameplay session.

## Key Features

### 🎮 Core Gameplay
- **3 Descending Floors**: Floor 3 → Floor 2 → Floor 1, each with escalating difficulty
- **Procedural Generation**: Deterministic maze layouts (51×41 tiles, 12-21 rooms per floor)
- **Resource Management**: Health, battery, and curse systems with meaningful risk/reward decisions
- **Survival Horror**: Navigate darkness with limited visibility and flashlight
- **Target Run Time**: 5-8 minutes for experienced players

### 👾 Enemy System

#### The Stalker (Primary Threat)
- **5 AI States**: Dormant, roaming, investigating, hunting, retreating
- **Difficulty Scaling**: 85% dormant on Floor 3 → 20% dormant on Floor 1
- **Speed**: 50-90 px/s roaming, 140-180 px/s hunting
- **Detection**: Sound-based (searching, moving), light-based (flashlight)
- **Damage**: 35 HP + 30 Curse per hit
- **Behavior**: Retreats when flashlight aimed directly at it

#### Crawlers (Secondary Enemies)
- Fast-moving patrol enemies (60 px/s patrol, 100 px/s chase)
- Detect player within 120px radius
- 3-second chase duration before returning to patrol
- **Damage**: 15 HP per hit
- **Population**: 2-4 per floor

#### Watchers (Area Denial)
- Stationary apparitions in dark corridors
- Apply curse when player approaches while facing them
- Disappear after 4 seconds of direct flashlight exposure
- **Effect**: ~2 curse/second when very close
- **Population**: 1-3 per floor

#### Mimics (Traps)
- Disguised as searchable containers with subtle visual tells:
  - Darker color (0x6e665c vs 0x8b7355)
  - Diagonal tape pattern (normal boxes have horizontal)
  - Periodic twitching animation
- **Damage**: 20 HP on reveal + 10 HP during 2-second chase phase
- **Population**: 0-1 (Floor 3), 1 (Floor 2), 1-2 (Floor 1)

### 💡 Lighting System
- **Dynamic Darkness**: MULTIPLY blend mode lightmap with rendered shadows
- **Directional Flashlight**: Cone-based illumination with battery drain
- **Ambient Vision**: Minimal visibility around player when flashlight is off
- **Camera System**: Main camera at 1.4x zoom + dedicated UI camera at 1.0x zoom
- **Post-Processing**: Corruption effects including scanlines, chromatic aberration, glitches

### 🎯 Interaction & Loot

#### Searchable Containers
- Cabinets, lockers, boxes, drawers with deterministic seeded loot
- Proximity-based interaction (press **E** within range)
- Visual feedback and sound effects
- Searching creates noise that can alert stalker

#### Loot Table (Seeded RNG)
- **20%** Battery (8-19% charge restoration)
- **12%** Medical Supplies (10-25 HP restoration)
- **25%** Score Collectibles:
  - ETH (common): +50 score
  - BTC (uncommon): +100 score
  - HEMI (rare): +250 score
- **8%** Clues (lore fragments)
- **35%** Empty containers
- **~2-5%** Mimics (disguised as containers)

*Note: Collectibles are fictional in-game score items only - no real cryptocurrency transactions occur during gameplay.*

### 🌊 Environmental Hazards

#### Moving Walls
- Corridors dynamically shift and block paths
- Safety validation ensures no player trapping
- Creates navigation pressure and forces route changes

#### Corruption Effects
- Screen glitches and visual distortion
- Chromatic aberration
- Scanline artifacts
- Static overlay
- Intensity increases with curse level

#### Jumpscare System
- **8 Event Types**: Door slams, shadow movement, false stalker, light flickers, footsteps, object movement, screen glitches, environmental scares
- Deterministic seeded director (no random spam)
- Triggers from: searching, entering rooms, collecting key, low battery, stalker proximity
- Global cooldown prevents event flooding
- Post-key escalation increases frequency

### 📊 Player Stats

#### HP (Health Points)
- Start: 100 / 100 HP
- Death at 0 HP
- Invulnerability frames: 1.5 seconds after taking damage
- Restored by medical supplies from loot (10-25 HP, cannot exceed 100)

#### Curse (Corruption Meter)
- Separate from HP
- Increases from: Watcher proximity, stalker attacks, corruption zones
- Death at 100 curse
- Visual corruption effects intensify with curse level

#### Battery
- Powers flashlight
- Drains while flashlight is active
- **+20% bonus** on floor completion (capped at 100%)
- **Persists between floors** (not reset)
- Restored by battery pickups from loot (8-19%)

#### Score
- Points from:
  - Collectibles (ETH +50, BTC +100, HEMI +250)
  - Floor completion bonuses
  - Survival time
- Submitted to blockchain after successful run

### 🔑 Floor Progression

1. **Spawn** on floor with stairs locked
2. **Explore** procedurally generated maze (dead ends, loops, branching paths)
3. **Search containers** for resources (risk/reward vs noise/mimics)
4. **Find key** (guaranteed spawn in predetermined room)
5. **Collect key** triggers escalation:
   - Stalker becomes more aggressive
   - Jumpscare frequency increases
   - Return journey is more dangerous
6. **Return to stairs** with key
7. **Unlock stairs** (press E at stairs with key)
8. **Descend** to next floor (press E again on unlocked stairs)
9. **Repeat** for Floors 2 and 1
10. **Victory** - Complete Floor 1 and submit score

### 🎮 Controls

- **WASD / Arrow Keys**: Move player (8-directional with collision)
- **F**: Toggle flashlight on/off
- **E**: Interact (search containers, pick up items, unlock/use stairs)

## Project Layout

- `src/` — React shell and Phaser game client
  - `game/` — Phaser game engine integration
    - `scenes/` — Game scenes (Boot, Floor)
    - `config.ts` — Phaser configuration
  - `core/` — Game logic modules:
    - `rng.ts` — Seeded random number generator
    - `floor.ts` — Procedural dungeon generation
    - `run.ts` — Run state management
    - `stalker.ts` — Primary enemy AI (5 states)
    - `secondaryEnemies.ts` — Crawler and Watcher classes
    - `movingWalls.ts` — Dynamic wall system
    - `corruption.ts` — Visual corruption effects
    - `jumpscares.ts` — Scare event director
- `contracts/` — Solidity run registry
  - `RunRegistry.sol` — On-chain seed generation and score tracking
- `docs/` — Design documentation
  - `game-design.md` — Detailed gameplay specifications

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Local Testing

The game supports **local play without wallet connection** for testing:
- Local runs bypass blockchain seed generation
- Full gameplay features available
- No score submission to chain

For blockchain features, connect MetaMask or compatible wallet to Hemi Network.

## Game Mechanics Deep Dive

### Procedural Generation
- **Seeded Deterministic**: Same seed always produces identical layout and loot
- **Floor Size**: 51×41 tiles (~2040 tiles per floor)
- **Room Count**: 12-21 rooms with guaranteed connectivity
- **Architecture**: Dead ends, loops, branching corridors
- **Enemy Placement**: Deterministic spawn points per seed
- **Loot Distribution**: Fixed container locations with seeded reward table

### Difficulty Scaling
- **Floor 3**: Introduction phase, 85% stalker dormancy
- **Floor 2**: Moderate pressure, more crawlers, scare frequency up
- **Floor 1**: High danger, 20% stalker dormancy, maximum enemy population
- **Post-Key**: Escalation phase on every floor after collecting key

### Resource Economy
- Battery persists across floors (no full refill)
- Health persists across floors
- Floor completion gives +20% battery bonus
- Medical supplies are uncommon (12% loot drop)
- Score collectibles encourage risky searching

## Smart Contract Integration

The `RunRegistry.sol` contract deployed on Hemi Network provides:
- **Verifiable Seed Generation**: Uses block hashes for unpredictable seeds
- **Run Tracking**: Records start time, seed, and player address
- **Score Submission**: One-time submission per completed run
- **Leaderboard Support**: On-chain score history for competitive play
- **Replay Verification**: Deterministic runs can be verified and replayed

## Technical Architecture

### Rendering System
- **Two-Camera Setup**:
  - Main camera: 1.4x zoom, renders world + enemies + lightmap
  - UI camera: 1.0x zoom, renders HUD only
- **Lightmap**: MULTIPLY blend mode applied once to main camera
- **HUD Elements**: Unaffected by world zoom and darkness
- **Performance**: Optimized for smooth 60 FPS gameplay

### State Management
- Persistent `RunState` across floor transitions
- Deterministic seeded RNG for all random events
- No state reset bugs (battery/HP persist correctly)

### Damage & Combat
- Invulnerability frames prevent damage stacking
- Multiple simultaneous enemy hits only apply once per i-frame window
- Flashlight creates safe space by repelling stalker

## Known Issues & Future Improvements

- Sound effects and ambient audio pending
- Additional enemy types in development
- Enhanced environmental storytelling
- Multiplayer leaderboard UI
- Mobile touch controls

## License

MIT

---

Built with 🔦 for Hemi Arcade Contest 2: Turbo Edition
