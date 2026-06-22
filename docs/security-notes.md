# SANAD Security Notes

This is an MVP contract and prototype. Before real funds:

## Contract review

- Add full unit tests for every request status transition.
- Test ERC-20 tokens that return no boolean, return false, revert, or charge fees.
- Add role transfer flow for `owner`.
- Decide whether provider removal should pause existing unpaid requests.
- Decide whether verifiers need staking, slashing, or multi-sig approval.
- Consider per-provider and per-request limits.
- Consider a circuit breaker for compromised providers or verifiers.

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
