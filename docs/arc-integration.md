# Arc Integration Guide

This guide turns the prototype into an Arc Testnet app.

## Network

Add Arc Testnet to a wallet:

```text
Network name: Arc Testnet
RPC URL: https://rpc.testnet.arc.network
Chain ID: 5042002
Currency symbol: USDC
Explorer: https://testnet.arcscan.app
```

Get testnet USDC and EURC from:

```text
https://faucet.circle.com
```

Source: https://docs.arc.io/arc/references/connect-to-arc

## Testnet token contracts

```text
USDC ERC-20 interface: 0x3600000000000000000000000000000000000000
EURC:                 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a
Memo:                 0x5294E9927c3306DcBaDb03fe70b92e01cCede505
Multicall3From:       0x522fAf9A91c41c443c66765030741e4AaCe147D0
Permit2:              0x000000000022D473030F116dDEE9F6B43aC78BA3
```

Source: https://docs.arc.io/arc/references/contract-addresses

Important: Arc docs note that native USDC gas uses 18 decimals, while the optional USDC ERC-20 interface uses 6 decimals. Use the token contract's `decimals()` before formatting amounts.

## Deployment path

1. Compile `contracts/SanadProtocol.sol` with Solidity `0.8.24`.
2. Deploy with constructor argument set to the operator wallet.
3. Call `setProvider(provider, true)` for pharmacies, clinics, schools, landlords, and utilities.
4. Call `setVerifier(verifier, true)` for human verifiers and approved verifier agents.
5. Frontend submits `submitRequest`.
6. Verifier calls `verifyRequest`.
7. Donors approve USDC/EURC and call `fundRequest`.
8. Provider, beneficiary, or verifier calls `payProvider`.

## Memo wrapping

For production-grade reconciliation, wrap SANAD calls in Arc's Memo contract:

```text
Memo.memo(
  target = SANAD_CONTRACT,
  data = encodedSanadCall,
  memoId = bytes32("SANAD-MED-0001"),
  memoData = abi.encode(metadataHash, category, providerInvoiceIdHash)
)
```

Use this for:

- `submitRequest`
- `verifyRequest`
- `fundRequest`
- `payProvider`

The Arc Memo event preserves the caller and creates an ordered event index. The SANAD contract emits protocol-level events too.

Source: https://docs.arc.io/arc/tutorials/send-usdc-with-transaction-memo

## Batch workflow

For NGO operators:

```text
Multicall3From.aggregate3([
  verifyRequest(id1, hash1),
  verifyRequest(id2, hash2),
  payProvider(id3),
  payProvider(id4)
])
```

Use it only after each request has already passed policy checks.

Source: https://docs.arc.io/arc/tutorials/batch-usdc-transfers

## Current frontend wiring

The dashboard is wired to Arc Testnet with `viem`:

1. Reads `VITE_SANAD_CONTRACT_ADDRESS` from `.env`, with the public Arc Testnet demo contract as a fallback.
2. Connects through an injected wallet such as Rabby.
3. Uses Arc Testnet chain ID `5042002`.
4. Reads request state from `requestCount`, `getRequestCore`, and `getRequestProof`.
5. Sends contract writes for `submitRequest`, `verifyRequest`, `rejectRequest`, `fundRequest`, and `payProvider`.
6. Keeps sensitive evidence offchain and stores hashes/memo IDs onchain.

## Minimum viable demo

Use these three transactions:

1. Operator approves one provider and one verifier.
2. Beneficiary submits one request with `metadataHash`.
3. Verifier verifies it, donor funds it, provider receives payout.

Show the request events on Arcscan and the dashboard audit feed.

## Current deployment

```text
SanadProtocol: 0x222df65e3f6f5840d14b04f352eb647201064d6a
Deploy tx:      0x585602783a8a32cba8856e4b6f8ffd3e7365c36404684f8b6b2cf13a29b3f462
```

Arcscan:

```text
https://testnet.arcscan.app/address/0x222df65e3f6f5840d14b04f352eb647201064d6a
```

The frontend reads this from `VITE_SANAD_CONTRACT_ADDRESS`, or falls back to the public demo deployment.
