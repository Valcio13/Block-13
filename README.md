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

The game now features:
- ✅ Phaser game engine integration with React
- ✅ BootScene with loading progression
- ✅ FloorScene with procedural floor generation
- ✅ Player movement with arrow keys
- ✅ Seeded floor layouts with walls/walkable tiles
- ✅ Key and exit markers on the map

Next steps: flashlight mechanics, battery system, stalker AI, and scare triggers.
