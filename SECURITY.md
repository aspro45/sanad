# Security Policy

SANAD is currently a testnet MVP. Do not use the deployed contract or frontend with real beneficiaries, private medical records, identity documents, or mainnet funds.

## Secrets

- Never commit `.env`.
- Never publish `ARC_DEPLOYER_PRIVATE_KEY`.
- Never add a private key as a `VITE_*` variable. Vite exposes `VITE_*` values to the browser bundle.
- Vercel should only receive public frontend variables:
  - `VITE_ARC_RPC_URL`
  - `VITE_ARC_CHAIN_ID`
  - `VITE_SANAD_CONTRACT_ADDRESS`

## Before Publishing

Run:

```bash
npm run check:repo-safe
npm run build
```

The repository should contain source code, public testnet addresses, public transaction hashes, and documentation only. Private keys belong only in a local `.env` file.

## Reporting Issues

For this prototype, report issues privately to the repository owner before posting public exploit details.
