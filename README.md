# SANAD Protocol

<p align="center">
  <strong>Private aid payments on Arc.</strong>
</p>

<p align="center">
  SANAD turns urgent medical, rent, school, and utility bills into verified stablecoin settlement flows:
  encrypted evidence in, provider payout out, dignity preserved.
</p>

<p align="center">
  <a href="https://sanad-arc.vercel.app"><strong>Live Demo</strong></a>
  |
  <a href="https://testnet.arcscan.app/address/0xa57dd3b2e5980246ecb6b1c41ff4415066e32f09"><strong>Arcscan Contract</strong></a>
  |
  <a href="docs/demo-proof.md"><strong>Testnet Proof</strong></a>
  |
  <a href="docs/architecture.md"><strong>Architecture</strong></a>
</p>

<p align="center">
  <img alt="SANAD live Arc aid desk" src="docs/assets/sanad-hero.png">
</p>

<p align="center">
  <img alt="Arc Testnet" src="https://img.shields.io/badge/Arc%20Testnet-5042002-acc6e9?style=for-the-badge">
  <img alt="Contract deployed" src="https://img.shields.io/badge/Contract-Deployed-1b3158?style=for-the-badge">
  <img alt="Lifecycle tested" src="https://img.shields.io/badge/Lifecycle-Paid-d5e0e7?style=for-the-badge">
  <img alt="Security boundary" src="https://img.shields.io/badge/Status-Testnet%20MVP-e9a13f?style=for-the-badge">
</p>

## What SANAD Is

SANAD is an Arc-native verified aid rail for private essential-bill settlement. It is not a public donation page and it is not an unrestricted cash-transfer app.

A beneficiary submits an encrypted bill bundle. A verifier checks the evidence offchain and writes a verification hash onchain. Donors fund the request in stablecoins. The smart contract releases funds only to the approved provider, such as a clinic, pharmacy, school, landlord, or utility.

The chain sees the request state, amount, token, provider, metadata hash, verifier hash, and memo ID. It does not store invoices, medical details, identity documents, diagnosis data, or private notes.

## Live Deployment

| Surface | Value |
| --- | --- |
| Production app | https://sanad-arc.vercel.app |
| Network | Arc Testnet |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | https://testnet.arcscan.app |
| Contract | `0xa57dd3b2e5980246ecb6b1c41ff4415066e32f09` |
| Deploy tx | `0x1f522810110d87114927c891a1bebf615b76751c30fbd1e30b49e2985c7e65e1` |
| Test token | Arc Testnet USDC interface at `0x3600000000000000000000000000000000000000` |

## Verified Testnet Run

The current deployment has a real Arc Testnet end-to-end proof.

| Step | Contract action | Public proof |
| --- | --- | --- |
| 1 | Allow provider | [`setProvider`](https://testnet.arcscan.app/tx/0xbd063cabd8036f94e0b43152ad8cb35b2d86052485b657e1fd48720b20fef152) |
| 2 | Allow verifier | [`setVerifier`](https://testnet.arcscan.app/tx/0xc7d21c434bbb3144c7bf1e4e71ec3165fdd19d0c25d951eeb4b33c17242b90d6) |
| 3 | Submit aid request | [`submitRequest`](https://testnet.arcscan.app/tx/0x94be8b05f9268dc877bd08227ad796a8116e24efe4b4afa388b4953939fc1316) |
| 4 | Verify request | [`verifyRequest`](https://testnet.arcscan.app/tx/0x297ef02c526e03b06769569697f3fce12b720741f8228d719aa4515ade2665ad) |
| 5 | Approve escrow transfer | [`approve`](https://testnet.arcscan.app/tx/0x46a1615b32c5631ba279f80b575fac841688375d8c8e7b2067a78dc2a9c16d05) |
| 6 | Fund request | [`fundRequest`](https://testnet.arcscan.app/tx/0xd94cc0f26c24de7794aeef2bde3f4a8ecc963e83d3aa48b95cfa9ee843f78740) |
| 7 | Pay provider | [`payProvider`](https://testnet.arcscan.app/tx/0xc4a69d1f7f0108f7f7796858a60dc219c667ff081fa71390ddb9fbb33ddbe3b7) |

Final request state: `Paid`

Request tested: `2`

Memo shown in app: `SANAD-TST-0001`

Full proof notes: [`docs/demo-proof.md`](docs/demo-proof.md)

## Why Arc

SANAD is designed around payment operations, not speculation.

| Arc capability | Why SANAD needs it |
| --- | --- |
| USDC-native fees | Aid operations can be budgeted in the same unit donors fund with. |
| Fast deterministic settlement | Providers can reconcile payouts quickly after funding completes. |
| Transaction memos | Every request can carry a searchable operational reference. |
| App Kits path | Bridge, send, swap, and balance flows map naturally to aid desks. |
| Future privacy path | The MVP keeps evidence encrypted offchain today and can adopt stronger Arc privacy primitives later. |

## How The Protocol Works

```mermaid
flowchart LR
  Beneficiary["Beneficiary<br/>encrypted evidence"]
  Verifier["Verifier<br/>offchain review"]
  Donor["Donor<br/>USDC or EURC"]
  Contract["SanadProtocol<br/>Arc Testnet escrow"]
  Provider["Approved provider<br/>clinic, school, landlord, utility"]
  Arcscan["Arcscan<br/>events, hashes, memo IDs"]

  Beneficiary -->|submitRequest| Contract
  Verifier -->|verifyRequest / rejectRequest| Contract
  Donor -->|fundRequest| Contract
  Contract -->|payProvider| Provider
  Contract -->|public proof| Arcscan
```

## Request Lifecycle

| Status | Meaning |
| --- | --- |
| `Submitted` | A beneficiary created an aid object with provider, token, amount, memo ID, and metadata hash. |
| `Verified` | An approved verifier checked offchain evidence and stored a verification hash. |
| `Funded` | Donors fully funded the escrow amount. |
| `Paid` | The approved provider received the payout. |
| `Rejected` | A verifier rejected the request with a private reason hash. |
| `Cancelled` | The beneficiary cancelled before verification. |
| `Refunded` | Donors reclaimed funds from an expired request. |

## Contract Surface

`contracts/SanadProtocol.sol` includes:

- Provider allowlist.
- Verifier allowlist.
- Aid request creation.
- Verification and rejection.
- Partial donor funding.
- Direct provider payout.
- Expired-request refunds.
- Reentrancy guard around token movement.
- Safe ERC-20 transfer handling for tokens that return `false`, revert, or return no boolean.

Core read functions:

```solidity
requestCount()
getRequestCore(uint256 requestId)
getRequestProof(uint256 requestId)
contributions(uint256 requestId, address donor)
approvedProviders(address provider)
approvedVerifiers(address verifier)
```

Core write functions:

```solidity
setProvider(address provider, bool approved)
setVerifier(address verifier, bool approved)
submitRequest(address provider, address token, uint256 amount, bytes32 category, bytes32 metadataHash, bytes32 memoId, uint256 deadline)
verifyRequest(uint256 requestId, bytes32 verificationHash)
rejectRequest(uint256 requestId, bytes32 reasonHash)
fundRequest(uint256 requestId, uint256 amount)
payProvider(uint256 requestId)
refundExpired(uint256 requestId)
```

## Repository Map

| Path | Purpose |
| --- | --- |
| `contracts/SanadProtocol.sol` | Solidity contract for verified aid escrow and provider payout. |
| `src/` | React/Vite frontend connected to Arc Testnet through `viem`. |
| `src/sanadContract.ts` | Wallet, contract reads, writes, metadata hashes, and explorer helpers. |
| `scripts/deploy-arc.mjs` | Compiles with optimizer + `viaIR`, deploys to Arc, and writes the address to `.env`. |
| `scripts/test-arc-contract.mjs` | Runs the live Arc Testnet lifecycle proof. |
| `scripts/check-repo-safe.mjs` | Scans the repo for private-key style secrets before pushing. |
| `docs/` | Product, architecture, integration, deployment, security, and proof notes. |
| `vercel.json` | Production deployment settings for Vite on Vercel. |

## Quick Start

```bash
npm install
copy .env.example .env
npm run dev
```

Open the local Vite URL, connect Rabby or another injected wallet, and switch to Arc Testnet.

Useful commands:

```bash
npm run build
npm run check:repo-safe
npm run deploy:arc
npm run test:arc-contract
```

`npm run test:arc-contract` uses `ARC_DEPLOYER_PRIVATE_KEY` from `.env`. Keep `.env` private and never commit a real key.

## Vercel Deployment

The public production app is live at:

```text
https://sanad-arc.vercel.app
```

Vercel settings:

```text
Framework: Vite
Install: npm install
Build: npm run build
Output: dist
```

Public frontend environment variables:

```text
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VITE_ARC_CHAIN_ID=5042002
VITE_SANAD_CONTRACT_ADDRESS=0xa57dd3b2e5980246ecb6b1c41ff4415066e32f09
```

The production bundle also contains the public Arc Testnet contract address as a fallback, so the demo still loads if Vite environment variables are not set.

Never set `ARC_DEPLOYER_PRIVATE_KEY` on Vercel.

## Security Boundary

This repository is ready for testnet demos, hackathons, grants, and technical review. It is not a mainnet audited financial product.

Already implemented:

- `.env` ignored and excluded from GitHub.
- `npm audit` passed with `0 vulnerabilities` at publication time.
- `check:repo-safe` scans for private-key style secrets.
- Contract stores hashes and memo IDs, not raw private evidence.
- Provider and verifier roles are allowlisted.
- Token movements use a reentrancy guard.

Required before real funds:

- Independent smart-contract audit.
- Unit and fuzz tests for every transition.
- Multisig or timelocked owner.
- Emergency pause and request limits.
- Multi-verifier approval for high-value or sensitive requests.
- Jurisdiction-specific review for aid, payments, privacy, and compliance.

## Roadmap

| Stage | Focus |
| --- | --- |
| MVP | Arc Testnet contract, live dashboard, verified request lifecycle. |
| Operator beta | Provider onboarding, verifier reputation, request search, audit exports. |
| Privacy beta | Encrypted evidence vault, salted canonical bundles, selective disclosure. |
| Scale | NGO batch operations, duplicate-invoice detection, grant reporting, provider analytics. |
| Production | Audit, multisig governance, incident response, compliance playbooks. |

## Project Thesis

Aid should not force people to publish their crisis.

SANAD makes essential-bill support verifiable for donors, operational for providers, and private for beneficiaries. The protocol keeps human context offchain, puts settlement guarantees onchain, and uses Arc as the payment layer for a new class of private, auditable aid rails.
