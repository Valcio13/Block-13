# FinalStateV1 canonical result

FinalStateV1 is the public deterministic result produced by the authoritative
simulation for a TX1 manifest and canonical input log. It is a compact result
projection, not a hash of the internal simulation snapshot. Current TX2 stores
the player's result commitment; it does not independently establish execution.
An independent verifier could later replay the run and derive these fields,
but no such verifier is part of the current contest flow.

## Schema and field purpose

| Order | Field | Type / bound | Purpose |
|---:|---|---|---|
| 1 | `version` | `u16`, exactly `1` | Selects this result protocol. |
| 2 | `runId` | `u256` | Binds the result to the TX1 per-player run nonce. |
| 3 | `player` | 20-byte address | Disambiguates equal per-player run IDs across players and matches TX1 identity. |
| 4 | `gameVersion` | 32 bytes | Prevents replaying a result under another game implementation version. |
| 5 | `rulesHash` | 32 bytes | Binds the result to the run's TX1 rules configuration. |
| 6 | `terminalTick` | `u32`, 1 through 4,294,967,295 | Commits the exact duration represented by the input log. |
| 7 | `outcome` | `u8`: `0` won, `1` lost | Commits the replay-derived terminal outcome. |
| 8 | `score` | `u32` | Commits the score derived by replay. |
| 9 | `floorsCompleted` | `u8`, 0 through 5 | Commits progression count needed to establish completion. |
| 10 | `finalFloor` | signed `i8`, -1 through 4 | Commits progression location; `-1` means Outside. |
| 11 | `finalHp` | `u16`, 0 through 65,535 | Commits terminal survival state. The standard game starts at 100 HP; larger values are reserved for explicit simulation fixtures and cannot pass replay validation unless replay produces them. |
| 12 | `finalBattery` | `u16`, 0 through 25,600 | Commits remaining battery in fixed-point units (1/256 percent). |
| 13 | `finalCurse` | `u16`, 0 through 25,600 | Commits terminal curse in fixed-point units (1/256 percent). |

Progression is coherent when `floorsCompleted == 4 - finalFloor`; a win must
end at floor `-1` with positive HP and curse below 100 percent. A loss must end
on floor 0 through 4 with zero HP or maximum curse. These are encoding checks.
Matching them to execution requires replay.

## Canonical binary layout

The encoding is exactly 135 bytes. Fields appear in the schema order above.
Every multi-byte integer is big-endian. Unsigned values use ordinary binary
representation. `finalFloor` uses signed 8-bit two's-complement representation.
Addresses and bytes32 values are raw bytes in the order written in their
hexadecimal form, without the `0x` prefix.

Byte offsets (end exclusive):

| Offset | Field | Width |
|---:|---|---:|
| 0 | version | 2 |
| 2 | runId | 32 |
| 34 | player | 20 |
| 54 | gameVersion | 32 |
| 86 | rulesHash | 32 |
| 118 | terminalTick | 4 |
| 122 | outcome | 1 |
| 123 | score | 4 |
| 127 | floorsCompleted | 1 |
| 128 | finalFloor | 1 |
| 129 | finalHp | 2 |
| 131 | finalBattery | 2 |
| 133 | finalCurse | 2 |

`finalStateHash = keccak256(canonical FinalStateV1 bytes)` using Ethereum
Keccak-256 (the `viem` `keccak256` implementation). No JSON serialization,
internal snapshot fields, or cosmetic state are included.

## Replay derivation and run binding

The game constructs the result from `AuthoritativeSimulation` only after its
state becomes terminal. An independent verifier could derive TX1 seeds, replay
the canonical input log, check `terminalTick`, and project the result, but no
verifier is implemented. Current TX2 stores a player-submitted commitment. The per-player TX1
`runId`, `player`, `gameVersion`, and `rulesHash` are committed into the bytes.
TX1's uint256 run ID is retained as a JavaScript `bigint`; it is never rounded
through `number`.

Local runs without a TX1 manifest do not receive a TX1-bound FinalStateV1.
They remain replayable through their stored local seed.
