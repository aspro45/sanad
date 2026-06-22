# SANAD Protocol

SANAD is an Arc-native verified aid rail for private essential-bill settlement. A beneficiary submits encrypted evidence, a verifier approves the request, donors fund it in stablecoins, and the smart contract pays the approved provider directly.

## Live Arc Testnet deployment

- Contract: `0xa57dd3b2e5980246ecb6b1c41ff4415066e32f09`
- Arcscan: https://testnet.arcscan.app/address/0xa57dd3b2e5980246ecb6b1c41ff4415066e32f09
- Deploy tx: https://testnet.arcscan.app/tx/0x1f522810110d87114927c891a1bebf615b76751c30fbd1e30b49e2985c7e65e1
- End-to-end test proof: [`docs/demo-proof.md`](docs/demo-proof.md)

## What is in this repo

- `contracts/SanadProtocol.sol` - Solidity escrow contract for verified aid requests.
- `src/` - React/Vite dashboard wired to Arc Testnet through `viem` and an injected wallet such as Rabby.
- `scripts/deploy-arc.mjs` - deploys the contract with Solidity optimizer + `viaIR` and writes the deployed address to `.env`.
- `scripts/test-arc-contract.mjs` - runs a live Arc Testnet flow: allowlist, submit, verify, approve, fund, and pay.
- `docs/` - product, architecture, Arc integration, security, and proof notes.

## Quick start

```bash
npm install
copy .env.example .env
npm run dev
```

Open the local Vite URL, connect Rabby, and switch to Arc Testnet.

## Arc Testnet

```text
RPC URL: https://rpc.testnet.arc.network
Chain ID: 5042002
Currency: USDC
Explorer: https://testnet.arcscan.app
Faucet: https://faucet.circle.com
```

## Commands

```bash
npm run build
npm run check:repo-safe
npm run deploy:arc
npm run test:arc-contract
```

`npm run test:arc-contract` uses `ARC_DEPLOYER_PRIVATE_KEY` from `.env`. Keep `.env` private and never commit a real key.

## Publish to GitHub

Before the first push:

```bash
npm run check:repo-safe
npm run build
git init
git add .
git commit -m "Initial SANAD protocol demo"
```

Create an empty GitHub repository, then follow GitHub's remote commands. Do not commit `.env`; it is local only.

## Deploy to Vercel

Vercel can import the GitHub repository directly. Use:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

Set only these environment variables in Vercel:

```text
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VITE_ARC_CHAIN_ID=5042002
VITE_SANAD_CONTRACT_ADDRESS=0xa57dd3b2e5980246ecb6b1c41ff4415066e32f09
```

Never set `ARC_DEPLOYER_PRIVATE_KEY` on Vercel. That key is only for local deploy/test scripts.

## Current demo status

- Contract deployed on Arc Testnet.
- Live request lifecycle tested: `Submitted -> Verified -> Funded -> Paid`.
- USDC ERC-20 interface tested at `0x3600000000000000000000000000000000000000`.
- Frontend builds successfully and reads the deployed contract address from `.env`.

## Arc fit

- USDC-native fees and stablecoin settlement.
- Direct provider payout instead of unrestricted cash transfer.
- Onchain request states with offchain encrypted evidence.
- Memo IDs and hashes for audit trails without exposing private invoices.
- Future path to Arc privacy features when they are production-ready.

## Security boundary

This is a testnet MVP. Do not use it with real beneficiaries or real funds until the contract, privacy model, verifier process, and jurisdiction-specific compliance have been reviewed.
