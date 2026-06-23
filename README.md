# SANAD Protocol

<p align="center">
  <img alt="SANAD private aid rail" src="docs/assets/sanad-hero.png">
</p>

<h3 align="center">Private aid payments on Arc.</h3>

<p align="center">
  SANAD turns urgent medical, rent, school, and utility bills into verified stablecoin settlement flows:
  encrypted evidence in, provider payout out, dignity preserved.
</p>

<p align="center">
  <a href="https://sanad-arc.vercel.app"><strong>Live app</strong></a>
  |
  <a href="https://sanad-arc.vercel.app/#blog"><strong>Project blog</strong></a>
  |
  <a href="https://testnet.arcscan.app/address/0x222df65e3f6f5840d14b04f352eb647201064d6a"><strong>Arcscan contract</strong></a>
  |
  <a href="docs/demo-proof.md"><strong>Testnet proof</strong></a>
  |
  <a href="https://x.com/ASPRO_22"><strong>ASPRO on X</strong></a>
</p>

<p align="center">
  <img alt="Arc Testnet" src="https://img.shields.io/badge/Arc%20Testnet-5042002-acc6e9?style=for-the-badge">
  <img alt="Contract deployed" src="https://img.shields.io/badge/Contract-Deployed-1b3158?style=for-the-badge">
  <img alt="Lifecycle tested" src="https://img.shields.io/badge/Lifecycle-Paid-d5e0e7?style=for-the-badge">
  <img alt="Security boundary" src="https://img.shields.io/badge/Status-Testnet%20MVP-e9a13f?style=for-the-badge">
</p>

## The Idea

Aid should not force people to publish their crisis.

SANAD is an Arc-native verified aid rail for essential-bill settlement. A beneficiary can submit a private bill object, an approved verifier can review the evidence offchain, donors can fund the request with stablecoins, and the smart contract can release funds directly to the approved provider.

The public chain sees the settlement facts: provider, token, amount, request status, metadata hash, verifier hash, memo ID, and events. The chain does not store invoices, diagnosis details, ID documents, family identity, or private notes.

## Live Project

| Surface | Link |
| --- | --- |
| Production app | https://sanad-arc.vercel.app |
| Project blog | https://sanad-arc.vercel.app/#blog |
| GitHub repo | https://github.com/aspro45/sanad |
| Founder updates | https://x.com/ASPRO_22 |
| Arc docs | https://docs.arc.io |
| Arc faucet | https://faucet.circle.com |
| Arcscan | https://testnet.arcscan.app |

## Contract Deployment

| Item | Value |
| --- | --- |
| Network | Arc Testnet |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| Contract | `0x222df65e3f6f5840d14b04f352eb647201064d6a` |
| Contract page | https://testnet.arcscan.app/address/0x222df65e3f6f5840d14b04f352eb647201064d6a |
| Deploy tx | `0x585602783a8a32cba8856e4b6f8ffd3e7365c36404684f8b6b2cf13a29b3f462` |
| Test USDC interface | `0x3600000000000000000000000000000000000000` |
| Test EURC interface | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |

## Verified Arc Testnet Run

This deployment has a real end-to-end lifecycle proof on Arc Testnet. Request `1` was submitted, verified, funded, and paid to the approved provider.

| Step | Contract action | Public proof |
| --- | --- | --- |
| 1 | Allow provider | [`setProvider`](https://testnet.arcscan.app/tx/0x5292221167cb3c9a8a1adab7374196d1a1f927ceed90f0c1971ea964cc2f1126) |
| 2 | Allow verifier | [`setVerifier`](https://testnet.arcscan.app/tx/0xe7408d81c48269a9494a8f22bf3703a6ddf80ecad6bd6dd2c61709848745b254) |
| 3 | Submit aid request | [`submitRequest`](https://testnet.arcscan.app/tx/0x4be79509e05c854ea7cb734b15cbdac4752ada196c6f55ad6afb68c70b96baf7) |
| 4 | Verify request | [`verifyRequest`](https://testnet.arcscan.app/tx/0x161baa463188f487289aeec408343e6271f8d894effeb815e2318745ff2a8367) |
| 5 | Approve escrow transfer | [`approve`](https://testnet.arcscan.app/tx/0xf4f05308d513acfd87abff18e85012db0cb41360a97fb7e98273b18086ba2be2) |
| 6 | Fund request | [`fundRequest`](https://testnet.arcscan.app/tx/0x4512b05e25c1b866f9f90382f32eb94c8f3b5050ad8653fad390ffe3a529cb3b) |
| 7 | Pay provider | [`payProvider`](https://testnet.arcscan.app/tx/0xdb2bdc949d99f8d27da54bb3bb5c250c39cd0e6daa117638cd8e89bfab97602d) |

Final state: `Paid`

Full notes: [`docs/demo-proof.md`](docs/demo-proof.md)

## Product Experience

The live website is built as a usable protocol surface, not only a landing page.

| Area | What it does |
| --- | --- |
| Private bill desk | Creates a request with category, provider, token, amount, deadline, and private note context. |
| Arc rail console | Reads live request data from the deployed Arc Testnet contract. |
| Proof packet | Shows metadata hash, verifier hash, memo ID, contract address, and Arcscan route. |
| Relief areas | Explains medical, housing, school, and utilities support with visual cards. |
| Protocol blog | Explains the problem, the Arc architecture, privacy boundary, and testnet proof. |
| Footer hub | Points users to GitHub, README, Arcscan, Arc docs, and ASPRO on X. |

## Protocol Flow

```mermaid
flowchart LR
  Beneficiary["Beneficiary<br/>private bill object"]
  Evidence["Encrypted evidence<br/>kept offchain"]
  Verifier["Approved verifier<br/>hashes review"]
  Donor["Donor<br/>funds USDC or EURC"]
  Contract["SanadProtocol<br/>Arc escrow"]
  Provider["Approved provider<br/>receives payout"]
  Arcscan["Arcscan<br/>events and proof"]

  Beneficiary --> Evidence
  Beneficiary -->|submitRequest| Contract
  Verifier -->|verifyRequest| Contract
  Donor -->|fundRequest| Contract
  Contract -->|payProvider| Provider
  Contract --> Arcscan
```

## Request States

| Status | Meaning |
| --- | --- |
| `Submitted` | A beneficiary created a request with provider, token, amount, memo ID, and metadata hash. |
| `Verified` | An approved verifier checked offchain evidence and posted a verification hash. |
| `Funded` | Donors fully funded the escrow amount. |
| `Paid` | The approved provider received the payout. |
| `Rejected` | A verifier rejected the request with a private reason hash. |
| `Cancelled` | The beneficiary cancelled before verification. |
| `Refunded` | Donors reclaimed funds from an expired request. |

## Smart Contract Surface

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

Core reads:

```solidity
requestCount()
getRequestCore(uint256 requestId)
getRequestProof(uint256 requestId)
contributions(uint256 requestId, address donor)
approvedProviders(address provider)
approvedVerifiers(address verifier)
```

Core writes:

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

## Why Arc

SANAD is designed around payment operations, reconciliation, and public proof.

| Arc capability | Why SANAD uses it |
| --- | --- |
| Stablecoin-native settlement | Aid requests can be priced, funded, and reconciled in the same unit. |
| Fast finality | Providers can receive payouts quickly after funding completes. |
| Arcscan visibility | Donors and operators can verify public state without seeing private documents. |
| App Kits path | Wallet, send, balance, and operational flows map naturally to an aid desk. |
| Privacy roadmap | The MVP stores hashes today and can adopt stronger privacy primitives later. |

## Run Locally

```bash
npm install
copy .env.example .env
npm run dev
```

Open the Vite URL and connect Rabby or another injected wallet on Arc Testnet.

Public frontend values:

```text
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VITE_ARC_CHAIN_ID=5042002
VITE_SANAD_CONTRACT_ADDRESS=0x222df65e3f6f5840d14b04f352eb647201064d6a
```

Private deployment/testing value:

```text
ARC_DEPLOYER_PRIVATE_KEY=0x...
```

Keep `.env` private. Never commit a real key.

## Quality Checks

```bash
npm run build
npm run check:repo-safe
npm audit
npm run test:contract:local
```

Live Arc Testnet proof:

```bash
npm run test:arc-contract
```

`npm run test:arc-contract` requires `ARC_DEPLOYER_PRIVATE_KEY` in `.env` and prints public transaction hashes only.

## Deploy Contract

```bash
npm run deploy:arc
```

The deploy script:

1. Compiles `contracts/SanadProtocol.sol` with optimizer and `viaIR`.
2. Deploys to Arc Testnet.
3. Writes the new contract address to `.env`.
4. Prints the Arcscan transaction link.

## Deploy Frontend

Production:

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

Set only public `VITE_` variables in Vercel. Do not set `ARC_DEPLOYER_PRIVATE_KEY` in Vercel.

## Repository Map

| Path | Purpose |
| --- | --- |
| `contracts/SanadProtocol.sol` | Solidity contract for verified aid escrow and provider payout. |
| `outputs/SanadProtocol_RemixReady.sol` | Single-file Remix copy of the contract. |
| `src/` | React/Vite frontend connected to Arc Testnet through `viem`. |
| `src/sanadContract.ts` | Contract reads, writes, wallet calls, hashes, and explorer helpers. |
| `scripts/deploy-arc.mjs` | Arc Testnet deployment script. |
| `scripts/test-arc-contract.mjs` | Live Arc Testnet lifecycle proof script. |
| `scripts/test-contract-local.mjs` | Local runtime contract tests with Ganache. |
| `scripts/check-repo-safe.mjs` | Private-key style secret scan before pushing. |
| `docs/` | Architecture, Arc integration, security model, deployment checklist, and proof notes. |
| `public/` | Production visual assets used by the website. |
| `vercel.json` | Vite deployment settings for Vercel. |

## Security Boundary

SANAD is ready for Arc Testnet demos, hackathons, grant review, and technical feedback. It is not a mainnet audited financial product.

Implemented now:

- `.env` is ignored and excluded from GitHub.
- `check:repo-safe` scans the repo for private-key style secrets.
- Contract stores hashes and memo IDs, not raw private evidence.
- Provider and verifier roles are allowlisted.
- Token movement uses a reentrancy guard.
- Local contract tests cover owner checks, allowlists, submit, verify, fund, payout, cancel, reject, and refund paths.

Required before real funds:

- Independent smart-contract audit.
- Expanded unit, fuzz, and invariant tests.
- Multisig or timelocked owner.
- Emergency pause and request limits.
- Multi-verifier approval for high-value or sensitive requests.
- Jurisdiction-specific review for aid, payments, privacy, and compliance.

## Roadmap

| Stage | Focus |
| --- | --- |
| MVP | Arc Testnet contract, live dashboard, verified request lifecycle, project blog. |
| Operator beta | Provider onboarding, verifier reputation, request search, CSV exports, grant dashboards. |
| Privacy beta | Encrypted evidence vault, canonical evidence bundles, selective disclosure. |
| Scale | NGO batch operations, duplicate-invoice detection, provider analytics, field workflows. |
| Production | Audit, multisig governance, incident response, compliance playbooks. |

## License

MIT
