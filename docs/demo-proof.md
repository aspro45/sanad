# SANAD Demo Proof

Date: 2026-06-22

Network: Arc Testnet

```text
Chain ID: 5042002
RPC: https://rpc.testnet.arc.network
Explorer: https://testnet.arcscan.app
Contract: 0xa57dd3b2e5980246ecb6b1c41ff4415066e32f09
```

## Deployment

- Contract address: https://testnet.arcscan.app/address/0xa57dd3b2e5980246ecb6b1c41ff4415066e32f09
- Deploy tx: https://testnet.arcscan.app/tx/0x1f522810110d87114927c891a1bebf615b76751c30fbd1e30b49e2985c7e65e1

## Latest live contract test

Request tested: `2`

This final smoke test was run after the GitHub and Vercel deployment checks. It confirmed the full request lifecycle again on the deployed contract:

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

- `setProvider`: https://testnet.arcscan.app/tx/0xbd063cabd8036f94e0b43152ad8cb35b2d86052485b657e1fd48720b20fef152
- `setVerifier`: https://testnet.arcscan.app/tx/0xc7d21c434bbb3144c7bf1e4e71ec3165fdd19d0c25d951eeb4b33c17242b90d6
- `submitRequest`: https://testnet.arcscan.app/tx/0x94be8b05f9268dc877bd08227ad796a8116e24efe4b4afa388b4953939fc1316
- `verifyRequest`: https://testnet.arcscan.app/tx/0x297ef02c526e03b06769569697f3fce12b720741f8228d719aa4515ade2665ad
- `approve`: https://testnet.arcscan.app/tx/0x46a1615b32c5631ba279f80b575fac841688375d8c8e7b2067a78dc2a9c16d05
- `fundRequest`: https://testnet.arcscan.app/tx/0xd94cc0f26c24de7794aeef2bde3f4a8ecc963e83d3aa48b95cfa9ee843f78740
- `payProvider`: https://testnet.arcscan.app/tx/0xc4a69d1f7f0108f7f7796858a60dc219c667ff081fa71390ddb9fbb33ddbe3b7

## Earlier live contract test

Request tested: `1`

The test script ran these live Arc Testnet actions:

1. Read `owner()` and confirmed it matches the deployer/test account.
2. Called `setProvider(testAccount, true)`.
3. Called `setVerifier(testAccount, true)`.
4. Submitted a request with `submitRequest`.
5. Read `getRequestCore` and `getRequestProof`.
6. Verified the request with `verifyRequest`.
7. Approved the USDC ERC-20 interface for escrow transfer.
8. Funded the request with `fundRequest`.
9. Paid the provider with `payProvider`.
10. Confirmed final request status is `Paid`.

## Transaction links

- `setProvider`: https://testnet.arcscan.app/tx/0xf61de4eed17ffeedf929670aecce22c981e0c7c7423e56f3754acf4651716e86
- `setVerifier`: https://testnet.arcscan.app/tx/0x2a91cd1be193e0c5bebf986bbcf0e53238e1c58ef99fa6493223da78721c502b
- `submitRequest`: https://testnet.arcscan.app/tx/0xbb97249ff17ce0dbda0dfd74ed17af80f4b135b486a98479277ecd86c5dbdd03
- `verifyRequest`: https://testnet.arcscan.app/tx/0x9b0cca39cc13654f3bd81a6aeeaa7dd51b0af2d0c472b89af9301f9427311154
- `approve`: https://testnet.arcscan.app/tx/0xc1457223334f86d75ca1c6c9cba647d977fbf7f9447d2ada7479983ac9a1f5dc
- `fundRequest`: https://testnet.arcscan.app/tx/0x0991b5bb1cfa3b75686eccb63e913dbd8ba00c8e1779ef39189786c01de1f239
- `payProvider`: https://testnet.arcscan.app/tx/0x939c4f39a8a2ee5a508baa2e44ab9cfc6da86e28444a684d3b27ae88a09661d6

## Re-run

```bash
npm run test:arc-contract
```

The script uses `.env` for the deployer private key. It prints public addresses and transaction hashes only.
