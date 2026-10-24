import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { hemiMainnet, hemiNetwork, hemiTestnet } from './config';

export const wagmiConfig = createConfig({
  chains: [hemiNetwork.chain],
  connectors: [injected()],
  transports: {
    [hemiTestnet.id]: http('https://testnet.rpc.hemi.network/rpc'),
    [hemiMainnet.id]: http('https://rpc.hemi.network/rpc'),
  },
});
