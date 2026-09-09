/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GAME_CONTRACT_ADDRESS: string;
  readonly VITE_HEMI_RPC_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
