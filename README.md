# Floor 13 — The Building That Never Existed

Floor 13 is a psychological survival horror game built for the **Hemi Arcade Contest 2: Turbo Edition**. An unknown message brings the protagonist to a building erased from official records. The current project is **deterministic and auditable**: a Phaser-free simulation owns gameplay outcomes, and recorded inputs can be replayed against that simulation.

> **Verification status:** TX2 stores the player's result and canonical replay hashes. It does not independently prove that gameplay was honestly executed. No verifier, backend, or signing service is implemented.

## Gameplay

The route is:

**Floor 4 → Floor 3 → Floor 2 → Floor 1 → Floor 13 → Outside**

Explore the building, search for evidence and supplies, and solve the distinct investigation on each floor. Floors 4 and 3 grant progression keys when their puzzles are solved; Floors 2, 1, and 13 unlock their next route directly through their completed puzzle objectives. The Floor 13 finale has no physical key pickup.

### Controls

- **WASD** or **arrow keys:** move
- **F:** toggle flashlight
- **E:** interact with containers, keys, and stairs
- **Escape:** pause
- **Tab:** open the field-notes notebook while playing

Audio and accessibility settings are available from the main menu and pause
menu. Volume, mute, and **Reduce Jumpscare Intensity** preferences are saved
in this browser. The intensity option changes the rendered flash, camera
kick, and scale punch only; it does not change warning timing or outcomes.

### Gameplay systems

- Procedurally generated connected floor layouts and deterministic search results
- Health, battery, curse, invulnerability, and score systems
- Stalker pursuit, Crawler chase/contact, Watcher curse, Ambusher warnings, and Mimic encounters
- Corruption events and gameplay scare lockouts
- Archive objective and stair progression from Floor 4 through Floor 13 to Outside
- Phaser lighting, enemy sprites, HUD, audio, camera effects, and scare visuals

## Deterministic architecture

`AuthoritativeSimulation` is a pure TypeScript gameplay layer that does not construct Phaser. It owns movement, static tile collisions, interactions, enemies, resources, loot, progression, score, and terminal state. Gameplay advances on a **fixed 60 Hz tick**. Gameplay-critical positions and resources use integer fixed-point values: 256 subpixels per world pixel, with integer movement remainders and documented truncation rules. The simulation engine carries tick backlog rather than discarding simulation time.

Resource values remain exact in simulation state. The HUD and transition rewards display percentages rounded to the nearest whole number, with exact halves rounded up; display formatting never changes authoritative battery or curse.

World generation, economy, events, and gameplay subsystems use separated deterministic PCG32 streams. Cosmetic effects are presentation-only and do not decide gameplay. Phaser samples live keyboard input through `InputSource`, sends the resulting inputs into the simulation, and renders simulation snapshots. Replay uses `InputReplayer` as the same input source for the same simulation path.

`InputLogV2` stores canonical binary input events and the terminal simulation tick. Its canonical hash is Ethereum Keccak-256 over the binary log. `FinalStateV1` is a compact canonical result containing run binding, terminal tick, outcome, score, progression, and final resources; it does not hash the internal simulation snapshot. See [ARCHITECTURE.md](ARCHITECTURE.md), [INPUT_LOG_V2_SPEC.md](INPUT_LOG_V2_SPEC.md), [FINAL_STATE_V1_SPEC.md](FINAL_STATE_V1_SPEC.md), and [run recovery behavior](docs/run-recovery.md).

## Web3 status

- **TX1 — Run Manifest:** Current procedural puzzle progression rules use game version `0.6.7` and the canonical rules hash `keccak256(UTF-8("floor13-procedural-puzzles-floor-progression-v8-valid-floor4-combination-digits"))`. This version validates the three-digit Floor 4 combination generation, keeps the authored maintenance lockbox exclusive to Floor 4, resolves the Floor 13 exit through memory completion without a physical key, and retains the current deterministic encounter balance; older identities remain historical. In-progress older-rule checkpoints are not migrated or replayed under the new rules. The RunRegistry ABI, manifest layout, InputLogV2 encoding, FinalStateV1 layout, and seed derivation algorithm remain unchanged.
- **Gameplay and replay:** Implemented locally in the game and covered by deterministic tests. InputLogV2 and FinalStateV1 are committed by TX2.
- **TX2 — completion/result commitment:** The contract accepts canonical score, outcome, terminal tick, InputLogV2 hash, and FinalStateV1 hash after an explicit player action. This commitment is deterministic and auditable, but does not independently prove honest execution.
- **Independent verifier/backend/signing:** Not implemented and not part of the current contest flow.

No private keys or signing secrets belong in this repository. Wallet actions use the connected wallet. TX1 entropy currently includes public Hemi Testnet, Ethereum Mainnet, and Bitcoin sources; see [TX1_RUN_MANIFEST_SPEC.md](TX1_RUN_MANIFEST_SPEC.md) for the current selection and seed details.

### Hemi Testnet configuration

- Chain ID: `743111`
- RPC: `https://testnet.rpc.hemi.network/rpc`
- Explorer: `https://testnet.explorer.hemi.xyz`
- Current RunRegistry deployment: `0xfd12F980daa569f4d60736da4227d1BDC15AF662` on Hemi Testnet (chain ID `743111`). `.env.example` contains this public contract address; override it in local `.env.local` if needed.

Browser entropy transport is configured with `VITE_ETH_RPC_URL` (the safe
example uses PublicNode). Ethereum tries that URL first, then the fixed
PublicNode and dRPC public RPC fallbacks in order; each gets a 4-second
timeout and one retry. Bitcoin keeps the Esplora one-confirmation reference
(`tip - 1`), tries Blockstream then mempool.space in fixed order, and compares
hashes for the selected height wherever providers respond. A disagreement
fails closed. These are transport fallbacks: BTC remains WORLD entropy and the
Ethereum block remains ECONOMY entropy.

The deployed registry includes the current TX2 ABI. For a future fresh
deployment, from PowerShell with Foundry installed and `PRIVATE_KEY` set in
the environment, use:

```powershell
forge script script/Deploy.s.sol:DeployScript --rpc-url hemi_testnet --broadcast --private-key $env:PRIVATE_KEY
```

Do not commit a wallet key or `.env` file. The deployment command is provided
for future deployments; the address above is the current Hemi Testnet registry.

## Development status

The deterministic simulation, InputLogV2, TX1 manifest integration, FinalStateV1 encoding, TX2 result commitment, and full-route replay tests are implemented. No independent Node verifier, verifier signing/service, or honest-execution proof exists. The current suite includes the full Floor 4 to Outside replay at multiple render schedules, after a long stall, and on repeated replay. Standard gameplay starts at 100 HP; the test suite also uses a separate high-HP traversal fixture to exercise the complete route.

Current local validation commands:

```bash
npm ci
npm test
npm run build
npm run dev
```

Use Node.js `^20.19.0` or `>=22.12.0` (the Vite engine requirement), with a
compatible npm release. Tests use Vitest. The production build runs TypeScript
project checks and Vite. To smoke-test the built output locally, run
`npm run preview -- --host 127.0.0.1` after `npm run build`.

### Hosting

The built client expects to be served from the web origin root (`/`): runtime
Asset manifests use a base-aware helper. Root hosting is the default; set
`VITE_BASE_PATH=/contest/block13/` at build time to target a nested path. The
configured prefix must match the path where the built files are served.

### Environment and wallet

Copy `.env.example` to `.env.local` for local configuration. Its `VITE_`
values are public client configuration (Hemi/Ethereum RPC URLs and the public
RunRegistry address), not secrets. Never put a wallet private key, seed
phrase, or other credential in a `VITE_` variable or commit an environment
file. Hemi runs require an injected wallet, Hemi Testnet (chain ID `743111`),
and testnet gas funds for the user's explicit start and completion
transactions. Local runs require no wallet and do not use Hemi.

## Project structure

- `src/core/authoritativeSimulation.ts` — Phaser-free authoritative gameplay
- `src/core/inputRecorder.ts` — InputSource, InputLogV2 recording, replay, and input hash
- `src/core/seedDerivation.ts`, `src/core/pcg32.ts`, `src/core/rng.ts` — manifest seeds and random streams
- `src/core/finalStateV1.ts` — canonical FinalStateV1 projection, encoding, decoding, and hash
- `src/game/` — Phaser presentation and keyboard adapter
- `src/web3/` — wallet, Hemi Testnet setup, TX1 manifest/entropy integration
- `contracts/RunRegistry.sol` — TX1 run registry and TX2 result commitment
- `tests/` and `src/core/*.test.ts` — replay, determinism, and core tests
- `docs/` — gameplay, art, audio, and design notes

The player-facing explanation of every floor puzzle is in
[docs/puzzle-guide.md](docs/puzzle-guide.md).

Current protocol and architecture documentation is indexed in [ARCHITECTURE.md](ARCHITECTURE.md). Older audit and implementation reports are retained as historical records; their headings identify reports that describe superseded behavior.

The current pre-release blockers and handoff checklist are in
[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). The npm package is marked
`private`; its `0.2.0` package metadata is internal project metadata and is
intentionally independent from the onchain game version `0.6.7`.
The current dependency advisory triage is in
[docs/dependency-audit-2026-10.md](docs/dependency-audit-2026-10.md).

## License

The software is MIT-licensed; see [LICENSE](LICENSE). Bundled art/audio have
separate rights and are not automatically covered by MIT. See
[ASSET_CREDITS.md](ASSET_CREDITS.md), [AUDIO_LICENSES.md](AUDIO_LICENSES.md),
and [the third-party audio record](docs/audio/THIRD_PARTY_AUDIO.md).
