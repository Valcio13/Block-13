# Block 13

Block 13 is a survival horror game built for the **Hemi Arcade Contest 2: Turbo Edition**. Players descend through a procedurally generated building while managing health, flashlight battery, and curse, then escape from Outside. The current project is **deterministic and auditable**: a Phaser-free simulation owns gameplay outcomes, and recorded inputs can be replayed against that simulation.

> **Verification status:** TX2 stores the player's result and canonical replay hashes. It does not independently prove that gameplay was honestly executed. No verifier, backend, or signing service is implemented.

## Gameplay

The route is:

**Floor 4 → Floor 3 → Floor 2 → Floor 1 → Block 13 → Outside**

On each floor, explore the maze, search containers for supplies and score, find the key, and reach the stairs. Enemies, traps, and gameplay scares make the return route dangerous. Progression, loot, damage, resources, score, and the ending are decided by the authoritative simulation.

### Controls

- **WASD** or **arrow keys:** move
- **F:** toggle flashlight
- **E:** interact with containers, keys, and stairs
- **Escape:** pause

### Gameplay systems

- Procedurally generated connected floor layouts and deterministic search results
- Health, battery, curse, invulnerability, and score systems
- Stalker pursuit, Crawler chase/contact, Watcher curse, Ambusher warnings, and Mimic encounters
- Corruption events and gameplay scare lockouts
- Key and stair progression from Floor 4 through Block 13 to Outside
- Phaser lighting, enemy sprites, HUD, audio, camera effects, and scare visuals

## Deterministic architecture

`AuthoritativeSimulation` is a pure TypeScript gameplay layer that does not construct Phaser. It owns movement, static tile collisions, interactions, enemies, resources, loot, progression, score, and terminal state. Gameplay advances on a **fixed 60 Hz tick**. Gameplay-critical positions and resources use integer fixed-point values: 256 subpixels per world pixel, with integer movement remainders and documented truncation rules. The simulation engine carries tick backlog rather than discarding simulation time.

Resource values remain exact in simulation state. The HUD and transition rewards display percentages rounded to the nearest whole number, with exact halves rounded up; display formatting never changes authoritative battery or curse.

World generation, economy, events, and gameplay subsystems use separated deterministic PCG32 streams. Cosmetic effects are presentation-only and do not decide gameplay. Phaser samples live keyboard input through `InputSource`, sends the resulting inputs into the simulation, and renders simulation snapshots. Replay uses `InputReplayer` as the same input source for the same simulation path.

`InputLogV2` stores canonical binary input events and the terminal simulation tick. Its canonical hash is Ethereum Keccak-256 over the binary log. `FinalStateV1` is a compact canonical result containing run binding, terminal tick, outcome, score, progression, and final resources; it does not hash the internal simulation snapshot. See [ARCHITECTURE.md](ARCHITECTURE.md), [INPUT_LOG_V2_SPEC.md](INPUT_LOG_V2_SPEC.md), and [FINAL_STATE_V1_SPEC.md](FINAL_STATE_V1_SPEC.md).

## Web3 status

- **TX1 — Run Manifest:** Implemented for starting a Hemi Testnet run. New manifests bind player/run identity, game version `0.4.0`, rules identifier `classic-static-walls-balance-v1-stalker-mimic-v1`, and selected multi-chain entropy sources. Seed derivation uses domain-separated Keccak-256 digests for WORLD, ECONOMY, and EVENT streams. The frozen manifest structure and encoding did not change.
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
npm install
npm test
npm run build
npm run dev
```

Tests use Vitest. The production build runs TypeScript project checks and Vite.

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

Current protocol and architecture documentation is indexed in [ARCHITECTURE.md](ARCHITECTURE.md). Older audit and implementation reports are retained as historical records; their headings identify reports that describe superseded behavior.

## License

MIT. See [LICENSE](LICENSE).
