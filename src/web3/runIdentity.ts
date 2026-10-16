import { keccak256, toBytes } from 'viem';

/** Human-readable rules identity bound to TX1 and deterministic seed derivation. */
export const GAME_VERSION = '0.6.3';
export const GAME_VERSION_BYTES32 = `0x${BufferlessHex(GAME_VERSION).padEnd(64, '0')}`;
export const LEGACY_GAME_VERSION = '0.4.0';
export const LEGACY_RULES_IDENTIFIER = 'classic-static-walls-balance-v1-stalker-mimic-v1';
export const LEGACY_RULES_HASH = keccak256(toBytes(LEGACY_RULES_IDENTIFIER));
export const HISTORICAL_GAME_VERSION = '0.4.1';
export const HISTORICAL_RULES_IDENTIFIER = 'classic-static-walls-balance-v2-stalker-mimic-v1';
export const HISTORICAL_RULES_HASH = keccak256(toBytes(HISTORICAL_RULES_IDENTIFIER));
export const PREVIOUS_GAME_VERSION = '0.4.2';
export const PREVIOUS_RULES_IDENTIFIER = 'classic-maintenance-lockbox-v1-static-walls-balance-v2-stalker-mimic-v1';
export const PREVIOUS_RULES_HASH = keccak256(toBytes(PREVIOUS_RULES_IDENTIFIER));
export const ARCHIVE_GAME_VERSION = '0.5.0';
export const ARCHIVE_RULES_IDENTIFIER = 'floor13-archive-objectives-expanded-maps-rare-encounters-v1';
export const ARCHIVE_RULES_HASH = keccak256(toBytes(ARCHIVE_RULES_IDENTIFIER));
export const PROCEDURAL_PUZZLE_GAME_VERSION = '0.6.0';
export const PROCEDURAL_PUZZLE_RULES_IDENTIFIER = 'floor13-procedural-puzzles-floor-progression-v1';
export const PROCEDURAL_PUZZLE_RULES_HASH = keccak256(toBytes(PROCEDURAL_PUZZLE_RULES_IDENTIFIER));
export const PREVIOUS_CURRENT_GAME_VERSION = '0.6.1';
export const PREVIOUS_CURRENT_RULES_IDENTIFIER = 'floor13-procedural-puzzles-floor-progression-v2-flashlight-drain-halved';
export const PREVIOUS_CURRENT_RULES_HASH = keccak256(toBytes(PREVIOUS_CURRENT_RULES_IDENTIFIER));

/** Balance changes affecting simulation state receive a distinct run identity. */
export const RULES_IDENTIFIER = 'floor13-procedural-puzzles-floor-progression-v4-spaced-searchables';

/** Canonical bytes32 rules identity: Keccak-256 of the identifier's UTF-8 bytes. */
export const RULES_HASH = keccak256(toBytes(RULES_IDENTIFIER));

function BufferlessHex(value: string): string {
  return [...new TextEncoder().encode(value)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
