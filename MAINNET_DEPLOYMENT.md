# Hemi Mainnet Deployment Preparation

This document records the Floor 13 RunRegistry Hemi Mainnet preparation. It
does not deploy contracts or broadcast transactions.

## Network targets

| Target | Chain ID | RPC | Explorer | Contract address |
|---|---:|---|---|---|
| Hemi Testnet | `743111` | `https://testnet.rpc.hemi.network/rpc` | `https://testnet.explorer.hemi.xyz` | `VITE_HEMI_TESTNET_CONTRACT_ADDRESS` |
| Hemi Mainnet | `43111` | `https://rpc.hemi.network/rpc` | `https://explorer.hemi.xyz` | `0x88b7Ac78c7964a2CbcFC8EC8e7bc9F8d39A3B059` |

The network values are maintained separately in `src/web3/config.ts` and in
the Foundry RPC aliases. The selected frontend network is controlled by
`VITE_HEMI_NETWORK=testnet|mainnet`. A mainnet build fails if its contract
address is missing; it never falls back to the testnet address.

## Pre-deployment checklist

- [ ] Decide and document that RunRegistry stores player-submitted TX1/TX2
      commitments; it does not independently verify gameplay.
- [ ] Resolve the release checklist blockers and review current dependency
      advisories.
- [ ] Install Foundry and confirm the pinned Solidity compiler is available.
- [ ] Run `forge build` and `forge test`.
- [ ] Confirm the exact game version and rules hash in the release commit.
- [ ] Use a dedicated deployment wallet funded only with the required Hemi ETH.
- [ ] Set `EXPECTED_CHAIN_ID=43111` and `VITE_HEMI_NETWORK=mainnet` only for
      the mainnet release environment.
- [ ] Confirm the supplied mainnet address and explorer verification before
      publishing the production build.

## Compile and test

```powershell
forge build
forge test
```

The current contract has no constructor arguments. `script/Deploy.s.sol`
requires `EXPECTED_CHAIN_ID` and checks `block.chainid` before broadcasting.

## Dry-run and gas preparation

Use a non-broadcast simulation against the explicit target RPC after Foundry
is installed. Do not use a default RPC or omit the expected chain ID.

```powershell
$env:EXPECTED_CHAIN_ID = "43111"
forge script script/Deploy.s.sol:DeployScript `
  --rpc-url hemi_mainnet `
  --gas-estimate `
  --private-key $env:PRIVATE_KEY
```

This command must remain without `--broadcast` during simulation. Keep the
private key in the process environment or a secure signer; never place it in
Vite variables, source files, or this document.

## Deployment command (run only as a separately approved operation)

```powershell
$env:EXPECTED_CHAIN_ID = "43111"
forge script script/Deploy.s.sol:DeployScript `
  --rpc-url hemi_mainnet `
  --broadcast `
  --private-key $env:PRIVATE_KEY
```

Record the resulting values immediately. Do not fill them in from memory or
from an unconfirmed wallet prompt.

## Deployment manifest

Create a release-owned manifest after deployment. Every field must come from
the deployment receipt, compiler output, wallet, or explorer:

```yaml
network: hemi-mainnet
chainId: 43111
contract: RunRegistry
contractAddress: "0x88b7Ac78c7964a2CbcFC8EC8e7bc9F8d39A3B059"
deploymentTransactionHash: ""
deployerAddress: ""
compilerVersion: "0.8.24"
optimizer: "not enabled unless explicitly configured"
bytecodeHash: ""
verificationUrl: ""
deploymentTimestamp: ""
```

Empty fields are intentional until the deployment exists. Do not fabricate
addresses, transaction hashes, timestamps, gas costs, or verification URLs.

## Explorer verification

Verify `RunRegistry.sol` on the Hemi Mainnet explorer using the exact compiler
version and optimizer settings used by Foundry. The contract has no
constructor arguments. Treat verification as incomplete until the explorer
shows the verified source and matching deployed bytecode.

## Frontend release configuration

```env
VITE_HEMI_NETWORK=mainnet
VITE_HEMI_MAINNET_CONTRACT_ADDRESS=0x88b7Ac78c7964a2CbcFC8EC8e7bc9F8d39A3B059
VITE_ETH_RPC_URL=https://ethereum-rpc.publicnode.com
```

Testnet remains independently runnable with:

```env
VITE_HEMI_NETWORK=testnet
VITE_HEMI_TESTNET_CONTRACT_ADDRESS=0xfd12F980daa569f4d60736da4227d1BDC15AF662
```

The frontend selects the matching chain, RPC, explorer, address, wallet
switching target, TX2 validation, and Hemi entropy client from the same
network selection. Local play does not require a wallet.

## Post-deployment smoke tests

Use a dedicated test wallet and explicit user approval for every transaction:

1. Connect on Hemi Mainnet and confirm the wrong-network message on Testnet.
2. Start one Hemi run and confirm the `RunStarted` event and run ID.
3. Confirm the manifest through `getRunManifest`.
4. Complete one run and confirm a single `RunCompleted` event.
5. Refresh during pending TX1 and TX2 and verify recovery blocks duplicate
   submissions until the explorer status is checked.
6. Confirm local play still starts without a wallet.
7. Confirm the explorer shows verified source and the recorded deployment
   address.

RunRegistry is immutable and has no pause or migration mechanism. A contract
defect requires a new deployment and a new frontend address; existing runs
remain at the original address.
