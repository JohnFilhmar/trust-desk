# 005: Who writes the audit row for a PII reveal

Status: provisional. Decided by the council on 2026-09-30 while I was away. I confirm or overturn it on the Phase 0 pull request.

## Context

An analyst can reveal the masked email, IP and device fingerprint of one account. Every reveal must leave an audit row. A reveal with no row is a compliance failure.

The handlers own reads. Rails owns enforcement writes and already writes an audit row for every enforcement action. The audit table is append-only. A reveal is a read of data, yet it must produce a write.

## Options

- **A.** The handlers insert the row themselves, through a database user granted INSERT on the audit table.
- **B.** The handlers make a signed call to Rails. Rails writes the row. The handlers return the unmasked data only after Rails confirms.

## The council's verdict

Three advisors and a chair. No peer-review round. This one split three ways.

**Agreed, all three:**

- A reveal fails closed. No audit row, no unmasked data.
- Neither option closes the real hole. The handlers' database user can read the raw columns, so a compromised handlers service could read PII and skip the audit step. Under A it would skip the insert. Under B it would skip the call.

**Disagreed:**

- *The Executor* chose B. The signed client, the nonce store and the Rails audit writer must exist anyway for suspend. A reveal is one more controller action.
- *The Contrarian* said B costs availability and buys no integrity, and that A lets the browser-facing service forge audit rows of any kind. It proposed taking the raw columns away from the handlers' user and having Rails read them.
- *The First Principles Thinker* said the question was wrong. The guarantee comes from whether the raw columns can be read without producing a row. It proposed a stored procedure that inserts the row and returns the values, with the handlers' user granted EXECUTE on it and nothing else.

**What the chair weighed that the advisors did not have:**

- The handlers must search by email fragment, IP and fingerprint, and must compute the masked form of each value. MySQL needs SELECT on a column to do either. Taking those columns away means moving search and masking into the database as well, which is far more than the 20 lines one advisor estimated.
- "Handlers own reads, Rails owns writes" is a locked decision. Bending it needs my approval, and I was not available.
- Rails loads the acting user and checks the group itself, so B adds a second authorization check that A does not have.

## Decision

Option B.

- Rails gets `POST /internal/reveals`. It verifies the signature, loads the staff user, checks the group, inserts the audit row and answers 201.
- The handlers run the unmasked SELECT only after a 201. Anything else returns 503 and no data.
- A timeout after Rails has committed leaves an audit row for a reveal that was never delivered. That over-records, which is the safe direction. There is no retry and no reconciliation.
- Masked reads keep working when Rails is down. A reveal is a privileged action, and the masked read is the read.

## The gap that remains

Stated plainly, because an interviewer will ask what stops the read service from skipping the audit:

> The audit guarantee is enforced in the handler path, not in the database. The handlers' database user can read raw PII, so a compromise of that service bypasses the audit. Rails checks the analyst's group but trusts the analyst id the handlers send.

## The next step, which needs my approval

Revoke SELECT on the raw columns from the handlers' user. Serve masked values from a definer view. Search through a definer procedure. Reveal through one definer procedure that inserts the audit row and returns the values. After that, an unaudited reveal is impossible for that user, not only discouraged.

This changes a locked decision and is too large for the time left, so it is written down and not built.

## Consequences

- One audit writer, in one language. The shape of an audit row is defined once.
- Every reveal pays for a signed round trip.
- Reveals stop while Rails is down. Search, account pages and timelines do not.
- The handlers' database user holds no INSERT on the audit table, so it cannot forge a row.
