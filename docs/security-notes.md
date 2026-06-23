# SANAD Security Notes

This is an MVP contract and prototype. The current Arc Testnet deployment includes the first security hardening pass, but it is still not a mainnet-audited financial product.

## Implemented in the current contract

- Two-step ownership transfer with `transferOwnership` and `acceptOwnership`.
- Emergency pause for submit, verify, reject, fund, pay, and cancel paths.
- Refunds remain available after expiry, including during an emergency pause.
- Provider allowlist.
- Verifier allowlist.
- Token allowlist with per-token max request cap.
- Request existence checks before mutating request storage.
- Deadline window limits: minimum 1 hour, maximum 90 days.
- Non-zero category, metadata, memo, verification, and rejection hashes.
- Reentrancy guard around token movement.
- Safe ERC-20 transfer handling for tokens that return no boolean, return false, or revert.
- Local runtime tests for owner checks, allowlists, token caps, pause, missing requests, submit, verify, fund, payout, cancel, reject, refund, and ownership transfer.

## Still required before real funds

- Independent smart-contract audit.
- Fuzz and invariant tests for every request status transition.
- Test ERC-20 tokens that return no boolean, return false, revert, or charge fees.
- Decide whether provider removal should pause existing unpaid requests.
- Decide whether verifiers need staking, slashing, or multi-sig approval.
- Add per-provider daily/monthly limits.
- Add multisig or timelock ownership.
- Add incident response playbook for compromised providers or verifiers.

## Privacy review

- Never store raw invoices, medical diagnosis, addresses, or identity documents onchain.
- Hashes can still leak patterns if metadata is predictable.
- Use salted hashes or encrypted content-addressed bundles.
- The frontend salts request metadata hashes before submitting new requests.
- Keep beneficiary identifiers pseudonymous by default.
- Build selective disclosure instead of global dashboards for sensitive users.

## Repository safety

- `.env` must remain local and ignored.
- Vercel must not receive `ARC_DEPLOYER_PRIVATE_KEY`.
- `npm run check:repo-safe` should pass before pushing to GitHub.

## Abuse cases

- Fake invoices from colluding providers.
- Duplicate invoice submissions.
- Donor manipulation or public shaming.
- Verifier capture.
- Provider address compromise.
- Medical or humanitarian data exposure.

## Policy controls

Recommended MVP rules:

- Each provider must be approved by operator.
- Each verifier must be approved by operator.
- Medical requests over a threshold require two verifiers.
- Payouts over a threshold require a time delay or multisig.
- Rejected requests should not reveal reason text publicly, only a `reasonHash`.
