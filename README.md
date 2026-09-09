# Block 13

An onchain 2D top-down survival-horror game built for the Hemi Arcade Contest 2: Turbo Edition.

## Run flow

1. `startRun()` creates a seeded run on Hemi.
2. The player clears three descending floors locally in the browser.
3. `submitScore()` records the completed run once.

No transactions occur during a gameplay session.

## Project layout

- `src/` — React shell and Phaser game client
  - `game/` — Phaser game engine integration
    - `scenes/` — Game scenes (Boot, Floor)
    - `config.ts` — Phaser configuration
  - `core/` — Game logic modules (RNG, floor generation, run state)
- `contracts/` — Solidity run registry and Hemi integration adapters
- `docs/` — game and technical design notes

## Local development

```bash
npm install
npm run dev
```

## Current scope

The game now features a complete playable MVP:

### ✅ Core Systems
- **Phaser game engine** integrated with React
- **Procedural dungeon generation** with rooms and corridors
- **Deterministic seeding** for reproducible runs
- **Player movement** with WASD/arrow keys and wall collision
- **Key collection** and locked stairwell mechanics
- **Floor progression** (3 → 2 → 1) with persistent run state
- **Scoring system** with escalating danger levels

### ✅ Floor Generation
- Room-based layouts (5-12 rooms per floor)
- L-shaped corridors connecting all rooms
- Door placement at room transitions
- Guaranteed reachability of all objectives
- Larger floors on deeper levels

### ✅ Gameplay Loop
1. Find the key (spawns in middle room)
2. Collect key to unlock stairs
3. Reach stairs to complete floor
4. Descend to next floor with new layout
5. Complete all 3 floors to win

### 🚧 Next Steps
- Flashlight mechanics with battery drain
- Stalker entity with AI behavior
- Jump-scare trigger system
- Sound effects and atmosphere
- Web3 integration (start run & submit score transactions)
