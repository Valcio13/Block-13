# Active Run Recovery

Recovery is presentation/storage orchestration around the existing deterministic simulation. It does not serialize an arbitrary mutable simulation snapshot or change InputLogV2, FinalStateV1, the registry ABI, TX1/TX2 arguments, or seed derivation.

## Checkpoint format and cadence

Browser `localStorage` key `block13:active-run:v1` contains schema 1:

- the original run state and exact canonical seed; Hemi runs include their original manifest and run ID;
- canonical InputLogV2 bytes encoded as base64;
- the replay boundary (`terminalTick`), Keccak hash of the input bytes, and a Keccak digest of the reconstructed authoritative-state JSON;
- a save timestamp.

BigInt run IDs use an explicit tagged decimal representation. No wallet private key, signing secret, or seed phrase is persisted. The game writes an initial tick-zero checkpoint before entering a new run, then checkpoints every 60 simulation ticks and immediately after a terminal tick. A crash can therefore roll back at most 60 ticks after the last successful checkpoint. If storage is unavailable or over quota, the game reports that refresh recovery may be unavailable and keeps playing; a failed periodic write leaves the last successful checkpoint intact. A Hemi run whose initial checkpoint cannot be stored remains blocked from another Hemi start because its TX1 already exists and is marked unresolved.

## Restore procedure

The client checks the schema, run identity, manifest-derived seed, InputLogV2 encoding/hash, replay boundary, event ordering, and supported rules identity. It rebuilds the simulation from the original seed and initial state, replays inputs up to the boundary, and compares the replayed authoritative-state digest. Only then does it resume with the restored tick and recorder-held input state. A mismatch or unsupported schema stops recovery and offers the user the choice to discard that saved run or leave it untouched. The old `sessionStorage.activeRun` format has no inputs, so it cannot recover progress and is identified as unrecoverable rather than treated as a fresh continuation.

The state digest detects accidental corruption and implementation drift; browser storage is user-controlled and the digest is not an anti-cheat or authenticity proof. Recovery is not independent replay verification.

## Protocol and wallet behavior

The current client resumes only Hemi checkpoints carrying the current `0.6.1` game version and flashlight-tuned procedural puzzle rules hash. Unfinished `0.6.0`, `0.5.0`, `0.4.0`, `0.4.1`, and `0.4.2` runs are not replayed under changed simulation rules. Historical onchain manifests and records remain unchanged; there is no migration of an old active run into a new TX1.

An onchain run's original manifest and run ID are preserved. Recovery never starts another TX1 or submits TX2. If refresh occurs while a TX1 or TX2 wallet request/receipt is unresolved, a pending marker blocks another Hemi transaction. The client does not claim to know whether it mined and does not resend automatically. The user must inspect the Hemi explorer and explicitly clear the marker after checking. Wallet account and Hemi Testnet chain are checked before TX2. Confirmed TX2 is recorded by run ID so a recovered terminal screen will not offer another completion.

This deliberately safe fallback does not query the registry to resolve unknown pending transaction status automatically. The pending-state UI and explorer confirmation remain part of release manual QA.

## Limits

- Browser storage may be cleared by the user, private browsing, quota pressure, or browser policy.
- At most 60 simulation ticks can be lost since the last periodic checkpoint.
- Cosmetic timers/story presentation are not restored; only gameplay input/simulation progress is reconstructed.
- A stored rules-v1 active run is rejected rather than silently resumed under rules-v2.
- This feature does not make TX2 a proof of honest gameplay.
