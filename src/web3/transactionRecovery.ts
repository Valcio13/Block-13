import type { RunManifest } from '../core/seedDerivation';
import { hemiTestnet } from './config';

export function tx2SubmissionBlockReason(
  manifest: RunManifest,
  wallet: { connected: boolean; address?: string; chainId?: number },
  hasUnresolvedTransaction: boolean,
): string | null {
  if (hasUnresolvedTransaction) return 'A transaction is unresolved. Check its status before submitting TX2.';
  if (!wallet.connected || !wallet.address || wallet.address.toLowerCase() !== manifest.player.toLowerCase()) {
    return 'Reconnect the wallet that started this Hemi run before submitting TX2.';
  }
  if (wallet.chainId !== hemiTestnet.id) return 'Switch to Hemi Testnet before submitting TX2.';
  return null;
}
