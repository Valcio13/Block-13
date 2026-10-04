import { defineChain } from 'viem';

export const hemiTestnet = defineChain({
  id: 743111,
  name: 'Hemi Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet.rpc.hemi.network/rpc'] } },
  blockExplorers: { default: { name: 'Hemi Explorer', url: 'https://testnet.explorer.hemi.xyz' } },
  testnet: true,
});

export const CONTRACT_ADDRESS = (import.meta.env.VITE_GAME_CONTRACT_ADDRESS as `0x${string}`) || '0x';

export const RUN_REGISTRY_ABI = [
  {
    type: 'function', name: 'startRun', stateMutability: 'nonpayable',
    inputs: [
      { name: 'gameMode', type: 'uint8' }, { name: 'gameVersion', type: 'bytes32' },
      { name: 'character', type: 'bytes32' }, { name: 'rulesHash', type: 'bytes32' },
      { name: 'btcBlockHash', type: 'bytes32' }, { name: 'hemiBlockHash', type: 'bytes32' },
      { name: 'ethBlockHash', type: 'bytes32' }, { name: 'hemiTxHash', type: 'bytes32' },
    ], outputs: [{ name: 'runId', type: 'uint256' }],
  },
  {
    type: 'function', name: 'completeRun', stateMutability: 'nonpayable',
    inputs: [
      { name: 'runId', type: 'uint256' }, { name: 'score', type: 'uint32' },
      { name: 'outcome', type: 'uint8' }, { name: 'terminalTick', type: 'uint32' },
      { name: 'inputHash', type: 'bytes32' }, { name: 'finalStateHash', type: 'bytes32' },
    ], outputs: [],
  },
  {
    type: 'function', name: 'getRunManifest', stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }, { name: 'runId', type: 'uint256' }],
    outputs: [{ name: 'manifest', type: 'tuple', components: [
      { name: 'player', type: 'address' }, { name: 'runId', type: 'uint256' },
      { name: 'gameMode', type: 'uint8' }, { name: 'gameVersion', type: 'bytes32' },
      { name: 'character', type: 'bytes32' }, { name: 'rulesHash', type: 'bytes32' },
      { name: 'btcBlockHash', type: 'bytes32' }, { name: 'hemiBlockHash', type: 'bytes32' },
      { name: 'ethBlockHash', type: 'bytes32' }, { name: 'hemiTxHash', type: 'bytes32' },
      { name: 'startedAt', type: 'uint64' },
    ] }],
  },
  {
    type: 'function', name: 'getCompletedRun', stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }, { name: 'runId', type: 'uint256' }],
    outputs: [{ name: 'result', type: 'tuple', components: [
      { name: 'completed', type: 'bool' }, { name: 'score', type: 'uint32' },
      { name: 'outcome', type: 'uint8' }, { name: 'terminalTick', type: 'uint32' },
      { name: 'inputHash', type: 'bytes32' }, { name: 'finalStateHash', type: 'bytes32' },
      { name: 'completedAt', type: 'uint64' },
    ] }],
  },
  {
    type: 'function', name: 'nextNonce', stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }], outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event', name: 'RunStarted', inputs: [
      { name: 'player', type: 'address', indexed: true }, { name: 'runId', type: 'uint256', indexed: true },
      { name: 'gameMode', type: 'uint8', indexed: false }, { name: 'gameVersion', type: 'bytes32', indexed: false },
      { name: 'btcBlockHash', type: 'bytes32', indexed: false }, { name: 'hemiBlockHash', type: 'bytes32', indexed: false },
      { name: 'ethBlockHash', type: 'bytes32', indexed: false }, { name: 'hemiTxHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event', name: 'RunCompleted', inputs: [
      { name: 'runId', type: 'uint256', indexed: true }, { name: 'player', type: 'address', indexed: true },
      { name: 'score', type: 'uint32', indexed: false }, { name: 'outcome', type: 'uint8', indexed: false },
      { name: 'terminalTick', type: 'uint32', indexed: false }, { name: 'inputHash', type: 'bytes32', indexed: false },
      { name: 'finalStateHash', type: 'bytes32', indexed: false },
    ],
  },
] as const;
