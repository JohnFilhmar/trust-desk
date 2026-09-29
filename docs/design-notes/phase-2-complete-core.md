# Design note: Phase 2, complete core

Written 2026-09-30, 06:45 UTC+8, before the work started.

## What

Everything the brief calls the core, built in the order it fixes: risk score, search by PII, masking and reveal, the other two enforcement actions, the timeline, operational modes, then throttling and what remains of the security list. The app works and passes its tests after every step.

## Why this order

A recruiter sees the risk score and the abuse clusters first, so those come first. Each later step is smaller, so if the clock runs out the missing part is the least visible one.

## Files touched

- `packages/shared/src/schemas/`: risk, events, reveal, operational mode, and the search query grows three fields
- `apps/handlers/src/lib/risk/`, `lib/rate_limit/`, `lib/pii/`, `lib/http/client_ip.ts`
- `apps/handlers/src/handlers/`: seven new handlers
- `apps/handlers/src/repositories/queries/`: risk, events, the search query
- `apps/core-api/db/migrate/`: one migration, for idempotency keys
- `apps/core-api/app/`: three new controllers, four services, one model
- `apps/web/src/`: risk panel, search form, reveal, timeline, mode banner
- `e2e/tests/`
- `docs/`: README, learning guide, demo script, interview notes, exercises

## Decisions taken in this note

Each is open to change on the pull request.

### 1. A reveal needs a reason

The brief left this open. I recommend yes, and built it.

- An audit row that says who revealed what is half an answer. The other half is why.
- The reason follows the same rule as enforcement, 10 to 500 characters, so there is one rule to learn.
- The cost is a few seconds per reveal. For a tool that shows customers' emails and IPs, that friction is the point.

### 2. Operational mode effects

Built as the brief proposed.

| Mode | What changes | Enforced by |
|---|---|---|
| `normal` | The review threshold is 60 | handlers |
| `elevated` | The review threshold drops to 40, and the console shows a banner | handlers |
| `lockdown` | The threshold is 40, the banner shows, and unsuspend is refused with `blocked_by_lockdown` | Rails |

Each effect has a test.

### 3. Search by PII needs a permission

Built as the brief proposed. `email`, `ip` and `fingerprint` need `accounts.search_pii`, which a viewer does not hold. A viewer who sends one gets 403, not an empty list, so the refusal is visible and is not mistaken for "no match".

A search by email fragment uses `LIKE '%text%'`, which cannot use an index. At 300 rows that costs nothing. At real volume it would need a full-text index or a search service, and the README says so.

Searches by IP and by fingerprint match the whole value and use the index on the generated column.

### 4. The list shows a quick score, the account page the full one

A page of 25 accounts would need about 150 queries to score each one in full. So:

- The list scores every row from the pre-aggregated table alone, in three queries for the whole page.
- The account page runs the full path: pre-aggregated rows first, raw events for the days that are missing or stale.

The two can differ for an account whose newest days are missing from the table. The account page is the one to trust, and it says how many days came from each source.

### 5. The idempotency key travels in the signed body

The browser sends it as the `Idempotency-Key` header, as the brief asks. The handlers copy it into the body they sign, so the signature covers it. Rails stores it with a hash of the request.

| Second request | Answer |
|---|---|
| Same key, same body | The stored response, with the stored status |
| Same key, different body | 422 `idempotency_key_reused` |
| Two at once | A unique index lets one through. The other gets the stored response |

### 6. Where each signal that spans accounts is computed

| Signal | Computed by | How |
|---|---|---|
| Shared fingerprint | the handlers, one query | counts accounts with the same `signup_fingerprint`, using its index |
| Signup velocity | the handlers, one query | counts accounts with the same `signup_ip` created within 60 minutes either side |
| Disposable email | the handlers, no query | compares the domain with a list in `risk_config.ts` |

### 7. The login throttle lives in memory

Ten failed logins per IP in five minutes. It counts by IP and never by account, so a stranger cannot lock out a demo user.

The counts live in the handlers process. They are lost on restart and would not be shared on AWS Lambda. The file names the limit and the replacement. nginx also limits `/api/login` to 10 requests a minute per IP, which holds across restarts.

## Tests

| Tier | What it proves |
|---|---|
| Jest, unit | every risk rule, the bands, the threshold per mode; the merge of pre-aggregated and fallback counts; payload masking; the throttle; the client IP resolver |
| Jest, handlers with a mocked database | each new endpoint: success, no session, wrong permission, bad input. A viewer searching by email gets 403 |
| Jest, against real MySQL | every query that uses a JSON path, a generated column, keyset pagination or the fallback. The fallback returns the same counts as the pre-aggregated table for a day both know |
| Rails, request tests | every action: a bad signature, a replayed request, a missing reason, the wrong group, an invalid state change, a repeated idempotency key |
| React, Testing Library | the risk panel, the search form, the reveal dialog, the timeline, the mode banner. jest-axe on the search page, the account page and the enforcement dialog |
| Playwright | the 2-minute demo script, step by step |

## Rails concepts this phase introduces

- **Scopes.** A named query on a model, such as `scope :newest_first, -> { order(created_at: :desc) }`. It chains like any other query method.
- **`ActiveSupport::CurrentAttributes`.** A place to hold values for the length of one request, such as the correlation id, without passing them through every method.
- **Tagged logging.** Every log line of a request carries the correlation id, set once in a `before_action`.
- **Rack middleware.** What runs before Rails routing. The learning guide walks the whole list for this app.
- **N+1 queries and `includes`.** Loading a list and then one row per item. `includes` loads the related rows in one query.
- **Fixtures.** YAML files that fill the test database before each test.
- **Callbacks.** Code a model runs around a save. This app uses one, to strip a reason, and the guide says why it avoids more.
