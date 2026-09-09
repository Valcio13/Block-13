import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { hemiTestnet } from './config';

export const wagmiConfig = createConfig({
  chains: [hemiTestnet],
  connectors: [injected()],
  transports: {
    [hemiTestnet.id]: http(),
  },
});
