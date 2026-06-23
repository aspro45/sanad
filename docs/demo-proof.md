# SANAD Demo Proof

Date: 2026-06-23

Network: Arc Testnet

```text
Chain ID: 5042002
RPC: https://rpc.testnet.arc.network
Explorer: https://testnet.arcscan.app
Contract: 0x222df65e3f6f5840d14b04f352eb647201064d6a
```

## Deployment

- Contract address: https://testnet.arcscan.app/address/0x222df65e3f6f5840d14b04f352eb647201064d6a
- Deploy tx: https://testnet.arcscan.app/tx/0x585602783a8a32cba8856e4b6f8ffd3e7365c36404684f8b6b2cf13a29b3f462

## Latest live contract test

Request tested: `1`

This final smoke test was run after the fixed contract redeploy. It confirmed the full request lifecycle again on the deployed contract:

1. Owner check passed.
2. Provider allowlist update passed.
3. Verifier allowlist update passed.
4. Request submission passed.
5. Request readback passed.
6. Verification passed.
7. USDC approval passed.
8. Funding passed.
9. Provider payout passed.
10. Final request status is `Paid`.

Latest transaction links:

- `setProvider`: https://testnet.arcscan.app/tx/0x5292221167cb3c9a8a1adab7374196d1a1f927ceed90f0c1971ea964cc2f1126
- `setVerifier`: https://testnet.arcscan.app/tx/0xe7408d81c48269a9494a8f22bf3703a6ddf80ecad6bd6dd2c61709848745b254
- `submitRequest`: https://testnet.arcscan.app/tx/0x4be79509e05c854ea7cb734b15cbdac4752ada196c6f55ad6afb68c70b96baf7
- `verifyRequest`: https://testnet.arcscan.app/tx/0x161baa463188f487289aeec408343e6271f8d894effeb815e2318745ff2a8367
- `approve`: https://testnet.arcscan.app/tx/0xf4f05308d513acfd87abff18e85012db0cb41360a97fb7e98273b18086ba2be2
- `fundRequest`: https://testnet.arcscan.app/tx/0x4512b05e25c1b866f9f90382f32eb94c8f3b5050ad8653fad390ffe3a529cb3b
- `payProvider`: https://testnet.arcscan.app/tx/0xdb2bdc949d99f8d27da54bb3bb5c250c39cd0e6daa117638cd8e89bfab97602d

## Re-run

```bash
npm run test:arc-contract
```

The script uses `.env` for the deployer private key. It prints public addresses and transaction hashes only.
