# Current architecture

This is the canonical overview of Block 13's contest architecture. The TX1, InputLogV2, and FinalStateV1 wire formats are specified in [TX1_RUN_MANIFEST_SPEC.md](TX1_RUN_MANIFEST_SPEC.md), [INPUT_LOG_V2_SPEC.md](INPUT_LOG_V2_SPEC.md), and [FINAL_STATE_V1_SPEC.md](FINAL_STATE_V1_SPEC.md).

## Run, replay, and completion

```text
TX1 Run Manifest
      ↓
canonical multi-chain seed derivation
      ↓
AuthoritativeSimulation ← InputSource ← live keyboard
      ↑                         ↓
      └── InputReplayer ← InputLogV2
                 ↓
        deterministic replay
                 ↓
            FinalStateV1
                 ↓
       explicit TX2 completeRun()
                 ↓
onchain result and replay-hash commitment
```

During live play, Phaser samples the keyboard only through `LiveInputSource`. Those per-tick inputs drive the Phaser-free authoritative simulation and are recorded in InputLogV2. Replay supplies the same inputs through `InputReplayer` to the same simulation. On a terminal tick, the game freezes the canonical binary log, derives FinalStateV1 from authoritative state, and hashes each exact byte sequence with Keccak-256. The player explicitly requests TX2 from the completion screen.

TX2 records the player's score, outcome, terminal tick, input hash, and final-state hash. It does **not** execute the game, replay the log, or independently prove honest gameplay. The current design is deterministic and auditable; there is no verifier, backend, or signing service.

## Responsibility boundaries

### Deterministic gameplay

`src/core/authoritativeSimulation.ts` owns player/enemy movement, static tile collision, detection and attacks, interactions, searches and loot, resources, scare lockouts, floor progression, score, and terminal outcome. It has no Phaser, DOM, or wall-clock dependency. `SimulationEngine` schedules fixed 60 Hz ticks and carries pending tick backlog across render updates.

Gameplay positions and resources use integer fixed-point values (256 subpixels per world pixel). Movement uses integer remainders and documented truncation. Deterministic PCG32 streams are domain separated for world/economy/event and gameplay subsystems.

### Phaser presentation

`src/game/scenes/FloorScene.ts` adapts live input and renders simulation snapshots as sprites, HUD, lighting, audio, camera movement, and effects. Arcade Physics does not determine gameplay movement or collisions. Visual animation and wall-clock effects do not feed back into authoritative state.

### Cosmetic systems

Scare overlays, sprite movement/twitch, lighting, audio, camera shake, and corruption visuals are presentation-only. Their gameplay triggers and lockouts are determined by simulation state/ticks. Cosmetic activity cannot consume gameplay RNG streams.

### Blockchain layer

`src/web3/` connects the wallet to Hemi Testnet for TX1 run creation and explicit TX2 completion. TX1 binds player/run identity, game version `0.2.0`, rules identifier `classic-static-walls`, and public multi-chain entropy. Seed derivation uses domain-separated Keccak-256 digests and preserves Solidity's `uint256` run ID as a JavaScript `bigint`.

TX2 commits the canonical result/replay hashes onchain. It is not an execution proof. Local runs use the same simulation and replay machinery without requesting wallet transactions.

## Key modules

- `src/core/authoritativeSimulation.ts` — deterministic gameplay implementation
- `src/core/simulationEngine.ts` — fixed tick scheduling
- `src/core/inputRecorder.ts` — live/replay input abstraction and InputLogV2
- `src/core/seedDerivation.ts`, `src/core/pcg32.ts`, `src/core/rng.ts` — seeds and random streams
- `src/core/finalStateV1.ts` — result projection and canonical bytes/hash
- `src/web3/tx2Completion.ts` — canonical TX2 argument derivation and submission orchestration
- `src/game/` — Phaser presentation and controls
- `src/web3/` and `contracts/RunRegistry.sol` — wallet, TX1 and TX2 contract integration
- `tests/` and `src/core/*.test.ts` — determinism, replay, contract-flow helper, and core coverage

## Current state

The repository tests deterministic simulation and full Floor 4 → Floor 3 → Floor 2 → Floor 1 → Block 13 → Outside replay across render schedules and long stalls. This is in-repository determinism coverage, not independent verification. The contract and frontend implement a direct player-submitted TX2 commitment; independent verification and honest-execution proof are not implemented.
