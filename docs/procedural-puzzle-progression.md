# Procedural Puzzle Progression (Rules 0.6.7)

Each generated floor carries one deterministic puzzle instance and a set of required evidence nodes. Puzzle generation uses a domain-separated PCG stream derived from the canonical low 32-bit world seed and floor id; it does not advance map, loot, enemy, or presentation RNG. Floor placement is deterministic geometry selection over walkable, non-door tiles and is bounded; tests validate 512 consecutive seeds plus signed/unsigned boundary seeds for reachable puzzle devices, clues, and fallback locations.

## Floor puzzles

- **Floor 4 — Locked Box:** a three-digit code, with one ordered arithmetic clue per digit. The player reduces each recovered expression to its final digit before entering the code. Correct entry opens the lockbox and grants the progression key and its battery reward. Three incorrect submissions jam the box; the reachable maintenance-tool fallback then completes the route when returned to the box.
- **Floor 3 — Missing Resident:** two indirect records require cross-referencing bicycle status and shift status against two other apartment entries in a four-person directory. Their combined constraints identify exactly one resident. Three incorrect submissions disable the directory. A separately placed archival addendum reveals the same identity and must be brought back to the directory.
- **Floor 2 — Power Circuit:** the maintenance diagram names exactly two of four labeled relays and gives their activation order. Selecting those two in sequence restores the stair mechanism.
- **Floor 1 — Contradictory Records:** two seed-generated ordering constraints uniquely reconstruct three events. Completing the order opens the apparent exit to Floor 13.
- **Floor 13 — Final Memory:** three memory fragments must be associated with three shuffled floor/memory records. Seed-derived evidence connects the anonymous message and earlier generated Floor 4/3 identities to the existing ending.

All floors require their placed evidence to be inspected before solution submission. Clue inspection is repeatable; only a submitted wrong answer consumes a Floor 4/3 attempt. Their fallback state and puzzle edits are part of `AuthoritativeState` and replay from recorded input.

## Input and protocol compatibility

Puzzle navigation uses the existing movement direction inputs as modal selections, `E`/`INTERACT` as submit/confirm, and `F`/`TOGGLE_FLASHLIGHT` (or Escape mapped to that same pulse) to close a panel. The existing action enum, InputLogV2 bytes, FinalStateV1 schema, RunRegistry ABI, TX1/TX2 layouts, and seed derivation are unchanged. While a puzzle panel is open, player/enemy simulation, damage, battery drain, and curse accumulation are paused; the panel open/close/selection/submission actions remain deterministic simulation ticks and replay exactly.

This document records the puzzle progression introduced in `0.6.0`. Later versions added calculation clues to the Floor 4 lock, ordered relay tracing to the Floor 2 circuit, deterministic container spacing, Floor 4-only lockbox placement, Floor 13 memory completion without a physical key, lower-floor encounter tuning, and valid non-zero Floor 4 combination generation. These are deterministic rules changes, so older checkpoints are rejected rather than replayed under the current `0.6.7` rules identity (`floor13-procedural-puzzles-floor-progression-v8-valid-floor4-combination-digits`).

The generated puzzle answer is not added to FinalStateV1. It is derived from the canonical run seed, and all state changes are reproduced from InputLogV2 actions under the versioned rule identity. Automated validation includes the full suite, production build, and diff check. On 2026-10-14, manual browser QA could not be completed: the in-app browser had no target tab, the local preview port was unreachable from it, and desktop browser access was denied. No visual/manual playthrough is claimed.
