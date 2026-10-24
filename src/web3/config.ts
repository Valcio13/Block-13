import { defineChain, keccak256, toBytes } from 'viem';

export const hemiTestnet = defineChain({
  id: 743111,
  name: 'Hemi Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet.rpc.hemi.network/rpc'] } },
  blockExplorers: { default: { name: 'Hemi Explorer', url: 'https://testnet.explorer.hemi.xyz' } },
  testnet: true,
});

export const hemiMainnet = defineChain({
  id: 43111,
  name: 'Hemi Mainnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.hemi.network/rpc'] } },
  blockExplorers: { default: { name: 'Hemi Explorer', url: 'https://explorer.hemi.xyz' } },
});

export type HemiNetworkName = 'testnet' | 'mainnet';

export type HemiNetworkConfig = {
  name: HemiNetworkName;
  chain: typeof hemiTestnet | typeof hemiMainnet;
  rpcUrl: string;
  explorerUrl: string;
  contractAddress: `0x${string}`;
};

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const ZERO_ADDRESS = `0x${'00'.repeat(20)}`;

function normalizeNetwork(value: unknown): HemiNetworkName {
  if (value === undefined || value === '') return 'testnet';
  if (value === 'testnet' || value === 'mainnet') return value;
  throw new Error(`Unsupported VITE_HEMI_NETWORK "${String(value)}". Use "testnet" or "mainnet".`);
}

function configuredAddress(network: HemiNetworkName, env: Record<string, unknown>): `0x${string}` {
  const value = network === 'mainnet'
    ? env.VITE_HEMI_MAINNET_CONTRACT_ADDRESS
    : (env.VITE_HEMI_TESTNET_CONTRACT_ADDRESS ?? env.VITE_GAME_CONTRACT_ADDRESS);
  if (typeof value !== 'string' || value.trim() === '') {
    if (network === 'mainnet') {
      throw new Error('Hemi Mainnet is selected but VITE_HEMI_MAINNET_CONTRACT_ADDRESS is not configured. Deploy and verify RunRegistry before building a mainnet client.');
    }
    return '0x';
  }
  const address = value.trim() as `0x${string}`;
  if (!ADDRESS_PATTERN.test(address) || address.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(`Invalid ${network} RunRegistry address. Expected a deployed 20-byte contract address.`);
  }
  return address;
}

/** Pure resolver used by the app and tests; it never silently crosses networks. */
export function resolveHemiNetworkConfig(env: Record<string, unknown>): HemiNetworkConfig {
  const name = normalizeNetwork(env.VITE_HEMI_NETWORK);
  const chain = name === 'mainnet' ? hemiMainnet : hemiTestnet;
  return {
    name,
    chain,
    rpcUrl: name === 'mainnet' ? 'https://rpc.hemi.network/rpc' : 'https://testnet.rpc.hemi.network/rpc',
    explorerUrl: name === 'mainnet' ? 'https://explorer.hemi.xyz' : 'https://testnet.explorer.hemi.xyz',
    contractAddress: configuredAddress(name, env),
  };
}

const selectedConfig = resolveHemiNetworkConfig(import.meta.env as unknown as Record<string, unknown>);
export const hemiNetwork = selectedConfig;
export const CONTRACT_ADDRESS = selectedConfig.contractAddress;

export function assertConfiguredContractAddress(): `0x${string}` {
  if (CONTRACT_ADDRESS === '0x') {
    throw new Error(`Hemi ${hemiNetwork.name} contract address is not configured. Set the matching ${hemiNetwork.name} RunRegistry address before starting an on-chain run.`);
  }
  return CONTRACT_ADDRESS;
}

export const RUN_STARTED_EVENT_TOPIC = keccak256(toBytes('RunStarted(address,uint256,uint8,bytes32,bytes32,bytes32,bytes32,bytes32)'));

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
