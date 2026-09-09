# Block 13

An onchain 2D top-down survival-horror game built for the Hemi Arcade Contest 2: Turbo Edition.

## Run flow

1. `startRun()` creates a seeded run on Hemi.
2. The player clears three descending floors locally in the browser.
3. `submitScore()` records the completed run once.

No transactions occur during a gameplay session.

## Project layout

- `src/` — React shell and Phaser game client
- `contracts/` — Solidity run registry and Hemi integration adapters
- `docs/` — game and technical design notes

## Local development

```bash
npm install
npm run dev
```

## Current scope

The initial vertical slice is a playable first floor with seeded room generation, a key-and-exit objective, flashlight pressure, one stalker, and deterministic jump-scare triggers.
