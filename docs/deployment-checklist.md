# SANAD Deployment Checklist

Use this before publishing or submitting the project.

## Local safety

- `.env` exists locally.
- `.env` is ignored by Git.
- `.env.example` contains placeholders only for private keys.
- No private key is pasted into README, docs, screenshots, or commit messages.
- `npm run check:repo-safe` passes before every public push.

## Contract proof

- Contract address is public in README.
- Deploy transaction is public in README.
- End-to-end test proof is in `docs/demo-proof.md`.
- `npm run test:arc-contract` passes on Arc Testnet.

## Frontend proof

- `npm run build` passes.
- `vercel.json` points Vercel to the Vite build and `dist` output.
- `.vercelignore` blocks local secrets and tooling folders from local Vercel uploads.
- `VITE_SANAD_CONTRACT_ADDRESS` points to the deployed contract.
- Rabby is connected to Arc Testnet.
- A wallet with testnet USDC can submit, verify, fund, and pay a request.

## Public launch

- Deploy the Vite app to Vercel, Netlify, Cloudflare Pages, or another static host.
- Set these hosted environment variables:
  - `VITE_ARC_RPC_URL`
  - `VITE_ARC_CHAIN_ID`
  - `VITE_SANAD_CONTRACT_ADDRESS`
- The public demo contract is also compiled as a fallback for Vercel preview/prod builds.
- Do not set `ARC_DEPLOYER_PRIVATE_KEY` on a public frontend host.
- Link the public website to the Arcscan contract page and `docs/demo-proof.md`.
