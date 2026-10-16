# Floor 13 redesign implementation note

## Current implementation

- Public identity and copy use **Floor 13 — The Building That Never Existed**;
  serialized floor IDs and protocol-facing internal names remain unchanged.
- The opening uses five authored 320×180 pixel-art plates for a 32-second
  sequence, with a restrained camera push, captions, continue/skip controls,
  and a fresh-run-only gate. Recovery and replay do not replay it. The plates
  are original generated artwork; source/provenance records are in
  `docs/visual-asset-provenance.md` and `art-production/narrative/`.
- Deterministic maps are larger: Floors 4/3/2/1 are 39×33, 43×37, 45×39,
  and 47×41 tiles; Floor 13 is 47×41. Mandatory clue searchables are placed
  deterministically on reachable room centers. Their progress is derived from
  generated objective indices and the existing searched bits; no new replay or
  committed-state encoding was introduced.
- The required floor clue sequence is: old photograph; missing-resident
  register and photograph; service fuse and archive terminal; sealed record
  and access note; final memory plus the existing Floor 13 key. Stairs/exit
  progression is authoritative. The maintenance lockbox is a reachable,
  optional battery reward on ordinary floors.
- Floor 4 starts without active pursuit. Its Stalker remains gated until the
  photograph is found; enemy roster bounds are lower on Floors 3–13. Cosmetic
  hauntings use a separate presentation director. The full-body Forgotten art
  is a presentation silhouette, not an authoritative enemy.
- The rules identity is version `0.6.0` with identifier
  `floor13-procedural-puzzles-floor-progression-v1`. Historical
  `0.5.0` archive/objective rules and earlier identities remain unchanged.
  `0.4.0`–`0.4.2` identities remain explicitly represented; old in-progress
  checkpoints are rejected safely instead of being interpreted as new rules.
  RunRegistry ABI, TX1/TX2 layouts, InputLogV2, FinalStateV1, and seed
  derivation were not extended.

## Encounter measurement

Mean generated mobile-enemy counts over seeds 1–128 (Crawler / Watcher /
Ambusher), computed by `tests/encounterDistribution.test.ts`:

| Floor | Prior rules | Floor 13 rules |
|---|---:|---:|
| 4 | 0 / 0 / 0.52 | 0 / 0 / 0 |
| 3 | 0.41 / 0.46 / 1.00 | 0.41 / 0 / 0.52 |
| 2 | 1.48 / 1.00 / 1.51 | 1.00 / 0.46 / 0.52 |
| 1 | 2.48 / 1.52 / 2.00 | 1.48 / 1.00 / 1.00 |
| 13 | 3.48 / 2.52 / 2.51 | 2.00 / 1.52 / 1.00 |

These are spawned counts, not observed encounter counts or a claim about
subjective pacing. Stalker and Mimic are not included in this table.

## Playtest and verification limits

`docs/playtest.md` describes fixed-seed local floor starts and dev-only audio,
haunting, Ambusher, and Block 3 comparison previews. Query overrides are only
applied to development Local runs; manifest-backed runs are not overridden.
The cinematic currently has authored moving-camera presentation but uses
static plates: there is no frame animation of the protagonist or dedicated
cinematic sound track. The normal ambience system remains settings-aware.

Automated verification passed: `npm test` (45 files, 266 tests),
`npm run build`, and `git diff --check`. The build reports the existing large
JavaScript chunk advisory and dependency annotation warnings. No actual Phaser
playthrough, audio listening check, floor navigation inspection, or finale
visual check was performed in this session; a local browser tab was not
available through the in-app browser tool. Treat those as manual release checks.
