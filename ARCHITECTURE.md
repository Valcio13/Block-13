# Current architecture

This is the canonical overview of the repository as it currently stands. For detailed wire formats, see [TX1_RUN_MANIFEST_SPEC.md](TX1_RUN_MANIFEST_SPEC.md), [INPUT_LOG_V2_SPEC.md](INPUT_LOG_V2_SPEC.md), and [FINAL_STATE_V1_SPEC.md](FINAL_STATE_V1_SPEC.md). The independent verifier and verified TX2 are future work.

## Run and replay flow

```text
TX1 Run Manifest
      ↓
canonical multi-chain seed derivation
      ↓
AuthoritativeSimulation ← InputSource ← live keyboard
      ↑                         ↓
      └── InputReplayer ← InputLogV2 (recorded alongside live simulation)
                 ↓
        deterministic replay
                 ↓
            FinalStateV1
                 ↓
     future independent verifier
                 ↓
     future signed verified TX2
```

During live play, Phaser keyboard state is sampled only by the live `InputSource`. Its per-tick input drives the authoritative simulation and is recorded by `InputRecorder`. During replay, `InputReplayer` supplies inputs to that same simulation path. InputLogV2 commits event changes and terminal tick; the canonical input hash is Keccak-256 of its canonical binary encoding.

After a terminal tick, the game projects selected authoritative fields into FinalStateV1 and hashes its canonical encoding. A future verifier must derive seeds from the TX1 manifest, replay the input log in the matching game/rules version, and independently derive the same terminal result. The current app does not run that verifier or submit this result on-chain.

## Responsibility boundaries

### Deterministic gameplay

`src/core/authoritativeSimulation.ts` owns player/enemy movement, static tile collision, detection and attacks, interactions, searches and loot, resources, scare lockouts, floor progression, score, and terminal outcome. It has no Phaser, DOM, or wall-clock dependency. `SimulationEngine` schedules its fixed 60 Hz ticks and carries pending tick backlog across render updates.

Gameplay positions and resources use integer fixed-point values (256 subpixels per world pixel). Movement uses integer remainders and documented truncation. Deterministic PCG32 streams are domain separated for world/economy/event and gameplay subsystems.

### Phaser presentation

`src/game/scenes/FloorScene.ts` is the input and presentation adapter. It samples live keyboard input, advances the simulation through the shared input pipeline, and renders its snapshots as sprites, HUD, lighting, audio, camera movement, and effects. It does not use Arcade Physics to decide gameplay movement or collisions. Visual animation and wall-clock effects do not feed back into authoritative state.

The HUD formats resource percentages to the nearest whole number, with exact halves rounded up. This is presentation formatting only; fixed-point resource state is unchanged.

### Cosmetic systems

Scare overlays, sprite movement/twitch, lighting, audio, camera shake, and corruption visuals are presentation-only. Their gameplay triggers and lockouts are determined by simulation state/ticks. Cosmetic activity cannot consume gameplay RNG streams.

### Blockchain layer

`src/web3/` connects a wallet to Hemi Testnet and starts a TX1 Run Manifest using multi-chain public entropy. The current values are game version `0.2.0` and rules identifier `classic-static-walls`. The frozen TX1 structure is unchanged; these values bind runs to the static-wall rules. Seed derivation uses canonical domain-separated Keccak-256 hashing and preserves the Solidity `uint256` run ID as a JavaScript `bigint`.

The app currently does not submit a score, input hash, or final-state hash. The legacy `submitScore(runId, score, actionHash)` method remains in the current Solidity contract and frontend ABI, but the game does not call it. The future verified TX2 flow requires the independent verifier and is not implemented.

## Key modules

- `src/core/authoritativeSimulation.ts` — deterministic gameplay implementation
- `src/core/simulationEngine.ts` — fixed tick scheduling
- `src/core/inputRecorder.ts` — live/replay input abstraction and InputLogV2
- `src/core/seedDerivation.ts`, `src/core/pcg32.ts`, `src/core/rng.ts` — seeds and random streams
- `src/core/finalStateV1.ts` — result projection and canonical bytes/hash
- `src/game/` — Phaser presentation and controls
- `src/web3/` and `contracts/RunRegistry.sol` — wallet, TX1 and current registry contract
- `tests/` and `src/core/*.test.ts` — determinism, replay, and core behavior coverage

## Current state

The repository tests deterministic simulation and full Floor 4 → Floor 3 → Floor 2 → Floor 1 → Block 13 → Outside replay across render schedules and long stalls. This is in-repository determinism coverage, not independent verification. The independent Node verifier, verifier signing/service, and verified TX2 are not implemented.
