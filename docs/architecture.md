# SANAD Architecture

## Current prototype

```text
React dashboard
  -> injected wallet such as Rabby
  -> viem Arc Testnet client
  -> deployed SanadProtocol contract

Solidity contract
  -> provider registry
  -> verifier registry
  -> aid request lifecycle
  -> ERC-20 escrow
  -> direct provider payout
  -> audit events
```

## Onchain contract

`contracts/SanadProtocol.sol` manages:

- approved providers
- approved verifiers
- request submission
- verification and rejection
- partial donor funding
- direct provider payout
- donor refund after expiry

The contract stores only hashes and references. It does not store invoices, medical details, identity documents, diagnosis data, or beneficiary private notes.

## Offchain evidence

For the MVP, sensitive files should live offchain:

- encrypted invoice PDF or image
- encrypted beneficiary note
- provider invoice ID
- verifier report
- optional proof bundle

The app should hash a canonical JSON evidence bundle and pass the hash to `submitRequest`.

Example:

```json
{
  "schema": "sanad.evidence.v1",
  "memoId": "SANAD-MED-0001",
  "providerInvoiceId": "CLINIC-2026-1882",
  "amount": "186.00",
  "token": "USDC",
  "category": "Medical",
  "encryptedFiles": [
    "ipfs://encrypted-invoice",
    "ipfs://encrypted-prescription"
  ]
}
```

## Arc transaction memos

Arc's Memo contract can wrap calls so SANAD transactions carry a searchable memo ID and memo bytes. The SANAD contract also emits its own `memoId` in events. This gives two layers of reconciliation:

- Arc Memo event for transaction-level accounting.
- SANAD request event for protocol-level accounting.

## Batch operations

For NGO workflows, Arc's Multicall3From can batch:

- verifier approvals
- donor funding actions
- provider payouts

This matters for field operators who need to settle many verified requests in one operational run.

## Future privacy stage

Arc privacy features are on the roadmap, so the current MVP should not claim confidential onchain execution. The staged plan is:

1. Today: hashes onchain, encrypted evidence offchain.
2. Next: selective disclosure credentials for beneficiaries and providers.
3. Later: private request state and confidential policy checks when Arc privacy is available.

## Data model

```text
AidRequest
  id
  beneficiary
  provider
  verifier
  token
  requestedAmount
  fundedAmount
  createdAt
  deadline
  category
  metadataHash
  verificationHash
  memoId
  status
```

## Safety boundaries

- Do not put raw medical data onchain.
- Do not let AI automatically approve high-risk claims without human override.
- Do not call the product a bank, insurance product, or medical provider.
- Do not promise regulatory compliance without jurisdiction-specific review.
- Use provider allowlists before direct settlement.
