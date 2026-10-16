import { describe, expect, it } from 'vitest';
import { tx2SubmissionBlockReason } from '../src/web3/transactionRecovery';
import type { RunManifest } from '../src/core/seedDerivation';

const manifest: RunManifest = {
  runId: 1n, player: `0x${'11'.repeat(20)}`, gameVersion: `0x${'22'.repeat(32)}`,
  rulesHash: `0x${'33'.repeat(32)}`, btcBlockHash: `0x${'44'.repeat(32)}`,
  hemiBlockHash: `0x${'55'.repeat(32)}`, ethBlockHash: `0x${'66'.repeat(32)}`,
  hemiTxHash: `0x${'77'.repeat(32)}`, startedAt: 1,
};

describe('onchain completion recovery guard', () => {
  it('requires the original connected account, Hemi Testnet, and no unresolved TX', () => {
    expect(tx2SubmissionBlockReason(manifest, { connected: true, address: manifest.player, chainId: 743111 }, false)).toBeNull();
    expect(tx2SubmissionBlockReason(manifest, { connected: false, chainId: 743111 }, false)).toMatch(/Reconnect/);
    expect(tx2SubmissionBlockReason(manifest, { connected: true, address: `0x${'88'.repeat(20)}`, chainId: 743111 }, false)).toMatch(/started this Hemi run/);
    expect(tx2SubmissionBlockReason(manifest, { connected: true, address: manifest.player, chainId: 1 }, false)).toMatch(/Hemi Testnet/);
    expect(tx2SubmissionBlockReason(manifest, { connected: true, address: manifest.player, chainId: 743111 }, true)).toMatch(/unresolved/);
  });
});
