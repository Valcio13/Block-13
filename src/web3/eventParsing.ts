import { RUN_STARTED_EVENT_TOPIC } from './config';

type ReceiptLog = {
  address: string;
  topics: readonly (string | undefined)[];
};

/** Parse only the RunStarted event emitted by the configured registry and wallet. */
export function parseRunStartedRunId(
  logs: readonly ReceiptLog[],
  contractAddress: string,
  playerAddress: string,
): bigint {
  const playerTopic = `0x${playerAddress.replace(/^0x/i, '').padStart(64, '0')}`.toLowerCase();
  const log = logs.find(candidate =>
    candidate.address.toLowerCase() === contractAddress.toLowerCase() &&
    candidate.topics[0]?.toLowerCase() === RUN_STARTED_EVENT_TOPIC.toLowerCase() &&
    candidate.topics.length >= 3 &&
    candidate.topics[1]?.toLowerCase() === playerTopic &&
    Boolean(candidate.topics[2])
  );
  if (!log?.topics[2]) throw new Error('Failed to parse RunStarted event');
  try {
    return BigInt(log.topics[2]);
  } catch {
    throw new Error('RunStarted event contained an invalid run ID');
  }
}
