# Hemi Testnet Integration - Implementation Report

## Changed Files

### New Files
- `src/web3/config.ts` - Chain config, contract ABI, Hemi Testnet definition
- `src/web3/wagmi.ts` - Wagmi configuration
- `src/web3/hooks.ts` - Wallet connection, startRun, submitScore hooks
- `src/vite-env.d.ts` - TypeScript environment variable types
- `test/RunRegistry.t.sol` - Foundry contract tests
- `foundry.toml` - Foundry configuration
- `script/Deploy.s.sol` - Contract deployment script
- `HEMI_INTEGRATION.md` - This document

### Modified Files
- `src/App.tsx` - Added Wagmi/React Query providers, wallet connect UI, transaction flow
- `src/core/run.ts` - Added `nonce`, `address` fields, `seedFromBytes32()`, `generateActionHash()`
- `.env.example` - Updated with contract address placeholder
- `src/styles.css` - Added error overlay styles
- `vite.config.ts` - Added server config (IPv4, port 3000)
- `package.json` - Added wagmi, viem, @tanstack/react-query

## Tests/Results

### Contract Tests (Foundry)
Run with: `forge test`

**Test Coverage:**
- ✅ `testStartRun` - Validates run creation and nonce
- ✅ `testMultipleRuns` - Multiple runs increment nonce
- ✅ `testDifferentPlayersSeparateNonces` - Isolated player state
- ✅ `testSubmitScore` - Score submission after 60s minimum
- ✅ `testCannotSubmitTooQuickly` - Enforces 60s minimum
- ✅ `testCannotSubmitTwice` - Prevents duplicate submission
- ✅ `testCannotSubmitUnknownRun` - Validates run existence
- ✅ `testCannotSubmitOtherPlayerRun` - Ownership validation
- ✅ `testSeedIsDeterministic` - Different blocks = different seeds
- ✅ `testRunStartedEvent` - Event emission
- ✅ `testScoreSubmittedEvent` - Event emission

### Build Status
✅ TypeScript compilation passes  
✅ Vite build succeeds (1.67MB bundle)  
✅ No runtime errors

## Required Environment Variables

Create `.env` file from `.env.example`:

```env
VITE_HEMI_RPC_URL=https://testnet.rpc.hemi.network/rpc
VITE_GAME_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
```

**Note:** Replace `VITE_GAME_CONTRACT_ADDRESS` after deployment.

## Contract Deployment

### Deploy to Hemi Testnet

```bash
# Install Foundry (if needed)
# curl -L https://foundry.paradigm.xyz | bash
# foundryup

# Run tests
forge test

# Deploy (requires private key with testnet ETH)
forge script script/Deploy.s.sol --rpc-url hemi_testnet --broadcast --private-key <YOUR_PRIVATE_KEY>

# Or deploy with Foundry interactively
forge create contracts/RunRegistry.sol:RunRegistry --rpc-url https://testnet.rpc.hemi.network/rpc --private-key <YOUR_PRIVATE_KEY>
```

After deployment:
1. Copy deployed contract address
2. Update `.env` with `VITE_GAME_CONTRACT_ADDRESS=<deployed_address>`
3. Restart dev server

### Get Testnet ETH
- Hemi Discord Faucet: https://discord.gg/hemixyz
- Request testnet ETH in #faucet channel

## No Blockers

Implementation is complete. Ready to deploy and test on Hemi Testnet.

## Manual Steps Required

1. **Install Foundry** (if testing/deploying contracts):
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Get Testnet ETH** from Hemi Discord faucet

3. **Deploy Contract** using Foundry script above

4. **Update `.env`** with deployed contract address

5. **Restart dev server** after updating `.env`

## Flow Verification

Once deployed, test the complete flow:

1. Open http://localhost:3000 (or port 3000)
2. Click "CONNECT WALLET" → MetaMask appears
3. Switch to Hemi Testnet if needed
4. Click "START RUN" → Transaction prompt
5. Confirm transaction → Wait for confirmation
6. Game starts with blockchain seed
7. Play through floors (no transactions)
8. Complete run → "SUBMITTING SCORE..." appears
9. Confirm transaction → "RUN COMPLETE!" screen

## Architecture Notes

- **Separation of concerns**: Web3 logic isolated in `src/web3/`
- **No gameplay transactions**: All gameplay runs locally
- **Deterministic RNG**: Blockchain seed feeds existing `SeededRng`
- **Simple anti-cheat**: Basic actionHash (can be enhanced later)
- **Error handling**: Wallet disconnect, wrong network, failed transactions
- **Retry support**: Failed submission preserves run state
- **Mainnet ready**: Change chain ID in `config.ts` when ready
