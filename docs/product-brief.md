# SANAD Product Brief

SANAD is a private essential-aid settlement protocol for Arc.

The first market is urgent medical and essential bills. A beneficiary submits encrypted evidence, a verifier confirms the request, donors fund the request in stablecoins, and the smart contract pays the provider directly.

## Problem

Aid and remittance flows are often slow, expensive, and hard to trust. Donors want proof that help was used correctly, while beneficiaries need privacy and dignity. Public blockchain payments can make this worse by exposing who needed help, why, and how much they received.

## First MVP

Private Medical Bill Rescue.

1. Beneficiary submits a request with encrypted invoice evidence.
2. Only the content hash, memo ID, category, provider, token, and amount go onchain.
3. A verifier approves the request after checking the offchain evidence.
4. Donors fund the request in USDC or EURC.
5. The contract pays the clinic or pharmacy directly after full funding.
6. Events provide auditability without exposing the invoice itself.

## Users

- Beneficiary: asks for help without public exposure.
- Verifier: checks evidence and signs off.
- Donor: funds verified bills.
- Provider: receives direct settlement.
- NGO/operator: manages approved providers and verifier reputation.

## Why Arc

- Arc Testnet RPC: `https://rpc.testnet.arc.network`.
- Chain ID: `5042002`.
- Native gas token: USDC.
- Testnet explorer: `https://testnet.arcscan.app`.
- Testnet faucet: `https://faucet.circle.com`.
- Arc memo contract can attach structured memo data to transactions.
- Arc Multicall3From can batch calls while preserving the original sender.

Sources:

- https://docs.arc.io/arc/references/connect-to-arc
- https://docs.arc.io/arc/references/contract-addresses
- https://docs.arc.io/arc/tutorials/send-usdc-with-transaction-memo
- https://docs.arc.io/arc/tutorials/batch-usdc-transfers

## What makes it different

SANAD is not a donation page. It is an evidence-gated settlement rail.

The beneficiary does not receive unrestricted funds. The provider gets paid directly after a verified request is funded. The donor gets an audit trail. The beneficiary does not have to publish sensitive medical, rent, school, or food details.

## Product moat

- Verified invoice settlement rather than generic giving.
- Private beneficiary history with selective disclosure.
- Provider reputation and duplicate-invoice detection.
- Agent/verifier marketplace using Arc agent standards later.
- NGO batch payouts with Arc transaction extensions.

