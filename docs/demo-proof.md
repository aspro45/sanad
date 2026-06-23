# SANAD Demo Proof

Date: 2026-06-23

Network: Arc Testnet

```text
Chain ID: 5042002
RPC: https://rpc.testnet.arc.network
Explorer: https://testnet.arcscan.app
Contract: 0xbf1ec5dc0ed9ca9356a2d5531894eaefdf111a03
```

## Deployment

- Contract address: https://testnet.arcscan.app/address/0xbf1ec5dc0ed9ca9356a2d5531894eaefdf111a03
- Deploy tx: https://testnet.arcscan.app/tx/0x7ab6533246b769ee2bc009e69519daf6fad45495daf16962c79ceb2dac4025a5

## Latest live contract test

Request tested: `1`

This final smoke test was run after the security-focused contract redeploy. It confirmed the full request lifecycle again on the deployed contract:

1. Owner check passed.
2. Provider allowlist update passed.
3. Verifier allowlist update passed.
4. Token allowlist and cap update passed.
5. Request submission passed.
6. Request readback passed.
7. Verification passed.
8. USDC approval passed.
9. Funding passed.
10. Provider payout passed.
11. Final request status is `Paid`.

Latest transaction links:

- `setProvider`: https://testnet.arcscan.app/tx/0x9a361d9caf5bc1d284e7bb2de6bd42dbcbf8f5d56955612cfa98a9ac8ea3b1d4
- `setVerifier`: https://testnet.arcscan.app/tx/0xa99ac0900346309f935ce451161153438dbaefcd3457add822758da75edb1b03
- `setToken`: https://testnet.arcscan.app/tx/0x0f130bb60b29959675c343146d64b47b8131087e7219da56362209b597f2a1a1
- `submitRequest`: https://testnet.arcscan.app/tx/0x57e8a3ed859a1ff9c0576b96978434056dd688211e9f1d677758593744246ac3
- `verifyRequest`: https://testnet.arcscan.app/tx/0x005720f4091e981194464da6fa93fea018cf4f8d2ba44d16f582de4429e88560
- `approve`: https://testnet.arcscan.app/tx/0xb0e8386100112feb58a46f3d57f267dd57a634e64d5411780d4e52e977cdcd73
- `fundRequest`: https://testnet.arcscan.app/tx/0x8d716e825c5aa417bae19eed064967fb766278f86fb34cf932c9a8129e959aba
- `payProvider`: https://testnet.arcscan.app/tx/0x1bd8d79ad38c464566bd70e13b7b246f028134228d7b1c342b38163590a74c73

## Re-run

```bash
npm run test:arc-contract
```

The script uses `.env` for the deployer private key. It prints public addresses and transaction hashes only.
