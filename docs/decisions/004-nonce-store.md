# 004: Nonce store for replay protection

Status: provisional. Taken from the default in the build brief, without a council run. I confirm or overturn it on the Phase 0 pull request.

## Context

Every call from the handlers to Rails carries a nonce. Rails must refuse a nonce it has already seen, so a captured request cannot be sent again. A nonce only matters inside the 60-second window on either side of the timestamp, so the store holds about two minutes of values.

## Options

- **A.** A MySQL table with a unique index on the nonce.
- **B.** Redis, using `SET key value NX EX 120`.

## Why no council

The brief names a default and gives the reason. The clock forced a cut from four council runs to two. The constraint that decides this one is a fact about the server, not a judgment call.

## Decision

Option A, the table `signed_request_nonces`.

- The production server is shared with another site and its memory has not been measured. Redis would be one more container on it.
- MySQL is already there, already backed by a volume, and already has a least-privilege user for Rails.
- The unique index settles a race. Two requests with the same nonce cannot both be inserted, even when they arrive together.

## Consequences

- One insert per signed call. At this demo's volume that costs nothing measurable.
- Old rows must be deleted. Rails removes rows older than the window when it checks a nonce.
- Redis would expire keys by itself and would be faster under heavy load. If enforcement traffic grew by orders of magnitude, this is the first thing I would move.
- The Rails database user holds SELECT, INSERT and DELETE on this table. The handlers user holds nothing on it, which I checked: `SELECT command denied to user 'td_handlers'`.
