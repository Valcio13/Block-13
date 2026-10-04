import { keccak256, toHex, type Hex } from 'viem';
import { decodeFinalStateV1, type FinalStateV1 } from '../core/finalStateV1';
import { InputRecorder, type InputEvent } from '../core/inputRecorder';
import type { RunManifest } from '../core/seedDerivation';

export interface CompleteRunArgs {
  runId: bigint;
  score: number;
  outcome: number;
  terminalTick: number;
  inputHash: Hex;
  finalStateHash: Hex;
}

export interface PreparedCompletion {
  finalState: FinalStateV1;
  args: CompleteRunArgs;
}

/** Build TX2 arguments exclusively from canonical, finalized protocol bytes. */
export function prepareRunCompletion(
  manifest: RunManifest,
  inputLogBytes: Uint8Array,
  finalStateBytes: Uint8Array,
): PreparedCompletion {
  const finalState = decodeFinalStateV1(finalStateBytes);
  const events = InputRecorder.decodeBinary(inputLogBytes) as InputEvent[] & { terminalTick: number };
  const terminalTick = events.terminalTick;
  if (terminalTick !== finalState.terminalTick) throw new Error('InputLogV2 and FinalStateV1 terminal ticks do not match');
  if (finalState.runId !== manifest.runId) throw new Error('FinalStateV1 runId does not match TX1 manifest');
  if (finalState.player.toLowerCase() !== manifest.player.toLowerCase()) throw new Error('FinalStateV1 player does not match TX1 manifest');
  if (finalState.gameVersion.toLowerCase() !== manifest.gameVersion.toLowerCase()) throw new Error('FinalStateV1 game version does not match TX1 manifest');
  if (finalState.rulesHash.toLowerCase() !== manifest.rulesHash.toLowerCase()) throw new Error('FinalStateV1 rules hash does not match TX1 manifest');

  return {
    finalState,
    args: {
      runId: finalState.runId,
      score: finalState.score,
      outcome: finalState.outcome === 'won' ? 0 : 1,
      terminalTick: finalState.terminalTick,
      inputHash: keccak256(toHex(inputLogBytes)),
      finalStateHash: keccak256(toHex(finalStateBytes)),
    },
  };
}

/** Local completion deliberately returns without requesting a wallet transaction. */
export async function submitRunCompletion<T>(options: {
  manifest?: RunManifest;
  inputLogBytes?: Uint8Array;
  finalStateBytes?: Uint8Array;
  submit: (args: CompleteRunArgs) => Promise<T>;
  confirm: (submission: T) => Promise<void>;
  onSubmitted?: (submission: T) => void;
}): Promise<{ local: true } | { local: false; prepared: PreparedCompletion; submission: T }> {
  if (!options.manifest) return { local: true };
  if (!options.inputLogBytes || !options.finalStateBytes) throw new Error('Canonical completion data is unavailable');
  const prepared = prepareRunCompletion(options.manifest, options.inputLogBytes, options.finalStateBytes);
  const submission = await options.submit(prepared.args);
  options.onSubmitted?.(submission);
  await options.confirm(submission);
  return { local: false, prepared, submission };
}
