# InputLogV2 canonical format

InputLogV2 is the canonical input recording for deterministic replay. The game samples input once for each simulation tick. Held movement controls are recorded when their state changes; flashlight and interact are one-tick actions recorded whenever pressed. Events preserve append order and have explicit ticks.

## Binary encoding

All integer fields are unsigned big-endian. The binary log is exactly `16 + 6 × eventCount` bytes:

| Offset | Field | Width | Rule |
|---:|---|---:|---|
| 0 | ASCII magic `BLK13INP` | 8 bytes | Exact bytes |
| 8 | format version | `u16` | Exactly `2` |
| 10 | event count | `u16` | 0 through 65,535 |
| 12 | terminal simulation tick | `u32` | Total number of ticks represented; may include trailing idle time |
| 16 onward | repeated events | 6 bytes each | `tick:u32`, `action:u8`, `state:u8` |

Action values are `0 = MOVE_LEFT`, `1 = MOVE_RIGHT`, `2 = MOVE_UP`, `3 = MOVE_DOWN`, `4 = TOGGLE_FLASHLIGHT`, and `5 = INTERACT`. State is `0 = released/false` or `1 = pressed/true`. Toggle/interact use pressed events; a replay source supplies these impulses on the recorded tick. Unknown actions, state values, versions, truncated data, or a length inconsistent with event count are rejected.

The canonical input hash is Ethereum Keccak-256 over the entire binary encoding, including the version and terminal tick:

```text
inputHash = keccak256(canonical InputLogV2 bytes)
```

The implementation uses `viem` `keccak256` and has one canonical encoding. The current game stores/uses logs locally for replay; it does not submit `inputHash` on-chain.
