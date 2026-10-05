import { keccak256, toBytes } from 'viem';

/** Human-readable rules identity bound to TX1 and deterministic seed derivation. */
export const RULES_IDENTIFIER = 'classic-static-walls-balance-v1-stalker-mimic-v1';

/** Canonical bytes32 rules identity: Keccak-256 of the identifier's UTF-8 bytes. */
export const RULES_HASH = keccak256(toBytes(RULES_IDENTIFIER));
