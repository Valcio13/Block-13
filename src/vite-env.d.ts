/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HEMI_NETWORK?: 'testnet' | 'mainnet';
  readonly VITE_HEMI_TESTNET_CONTRACT_ADDRESS?: string;
  readonly VITE_HEMI_MAINNET_CONTRACT_ADDRESS?: string;
  /** Legacy testnet alias; prefer the network-specific variables. */
  readonly VITE_GAME_CONTRACT_ADDRESS?: string;
  readonly VITE_ETH_RPC_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
