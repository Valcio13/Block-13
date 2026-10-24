import { describe, expect, it } from 'vitest';
import { resolveHemiNetworkConfig, RUN_STARTED_EVENT_TOPIC } from '../src/web3/config';
import { parseRunStartedRunId } from '../src/web3/eventParsing';

const testnetAddress = '0x1111111111111111111111111111111111111111';
const mainnetAddress = '0x2222222222222222222222222222222222222222';
const player = '0x3333333333333333333333333333333333333333';
const playerTopic = `0x${player.slice(2).padStart(64, '0')}`;

describe('Hemi network configuration', () => {
  it('resolves isolated testnet and mainnet settings', () => {
    const testnet = resolveHemiNetworkConfig({
      VITE_HEMI_NETWORK: 'testnet',
      VITE_HEMI_TESTNET_CONTRACT_ADDRESS: testnetAddress,
    });
    const mainnet = resolveHemiNetworkConfig({
      VITE_HEMI_NETWORK: 'mainnet',
      VITE_HEMI_MAINNET_CONTRACT_ADDRESS: mainnetAddress,
    });
    expect(testnet.chain.id).toBe(743111);
    expect(testnet.contractAddress).toBe(testnetAddress);
    expect(mainnet.chain.id).toBe(43111);
    expect(mainnet.rpcUrl).toBe('https://rpc.hemi.network/rpc');
    expect(mainnet.contractAddress).toBe(mainnetAddress);
  });

  it('fails closed for unsupported networks and missing mainnet addresses', () => {
    expect(() => resolveHemiNetworkConfig({ VITE_HEMI_NETWORK: 'preview' })).toThrow(/testnet|mainnet/);
    expect(() => resolveHemiNetworkConfig({ VITE_HEMI_NETWORK: 'mainnet' })).toThrow(/MAINNET_CONTRACT_ADDRESS/);
    expect(() => resolveHemiNetworkConfig({
      VITE_HEMI_NETWORK: 'mainnet', VITE_HEMI_MAINNET_CONTRACT_ADDRESS: '0x0',
    })).toThrow(/Invalid mainnet/);
  });
});

describe('RunStarted receipt parsing', () => {
  it('requires the expected event topic, contract, and player', () => {
    const logs = [
      { address: '0x9999999999999999999999999999999999999999', topics: [RUN_STARTED_EVENT_TOPIC, playerTopic, '0x01'] },
      { address: '0x4444444444444444444444444444444444444444', topics: ['0xdeadbeef', playerTopic, '0x02'] },
      { address: '0x4444444444444444444444444444444444444444', topics: [RUN_STARTED_EVENT_TOPIC, playerTopic, '0x2a'] },
    ];
    expect(parseRunStartedRunId(logs, logs[2].address, player)).toBe(42n);
    expect(() => parseRunStartedRunId(logs.slice(0, 2), logs[2].address, player)).toThrow(/RunStarted/);
  });
});
