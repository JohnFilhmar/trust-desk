# Demo script

Two walkthroughs. The first is for a recruiter and takes 2 minutes. The second is for an engineer and takes 10.

Every account named here is written by the seed on every run. If one is missing or already suspended, reset the data:

```
docker compose -f docker-compose.dev.yml run --rm migrate bin/rails db:seed
```

The Playwright test `e2e/tests/demo.spec.ts` follows the 2-minute script step by step. A passing run means the demo works.

## Before any demo

| Check | How |
|---|---|
| The site answers | open `https://trust.filhmar.online/api/health` and expect `{"status":"ok","database":"up"}` |
| The data is fresh | the daily reset ran, or run the seed |
| The mode is normal | no banner at the top of the console |
| A fallback exists | the recording linked from the README, in case the site is down |

## The 2-minute walkthrough

**The story:** a ring of 12 fake accounts was created from one device. An analyst finds it and an enforcer acts on it.

### 0:00 Sign in

Open `https://trust.filhmar.online`. Click **Sign in as Demo Analyst**.

Say: "This is a Trust and Safety console. All the data is synthetic. I built it for this application, and I learned Rails doing it."

### 0:15 Find the ring

In the search form, paste this into **Device fingerprint, the whole value** and click **Search**:

```
9f2c4e6a8b0d1f3e5a7c9e1b3d5f7a90
```

Twelve accounts appear.

Say: "Twelve accounts signed up from one device. Notice that the emails are masked, even though I searched by the full fingerprint. Masking happens on the server."

Point at the risk column and the **Review** badge.

### 0:40 Read why it is risky

Click the first account.

Point at the risk panel. Read the top signal aloud: "11 other accounts signed up with the same device fingerprint."

Say: "The score is rule-based, not machine learning. Every point traces to a number an analyst can check. All seven signals are listed, the ones that scored zero too, so you can see what was checked."

### 1:00 Reveal PII, with a reason

Click **Reveal PII**. Type a reason:

```
Checking whether the ring shares an email pattern.
```

Click **Reveal**. The email, IP and fingerprint appear unmasked, with a **Revealed** badge.

Say: "A reveal needs a reason and leaves an audit row. The server writes the audit row first and unmasks only after that. If the audit cannot be written, nothing is revealed."

### 1:20 Enforce

Click **Sign out**, then **Sign in as Demo Enforcer**. Search the same fingerprint and open an account whose status is Active.

Click **Suspend account**. Type a reason:

```
Part of a 12-account ring sharing one device fingerprint.
```

Click **Confirm suspension**.

Say: "The browser never talks to Rails. It talks to a TypeScript layer, which makes a signed call to Rails. Rails checks the signature, checks my permission again, and writes three rows in one transaction."

### 1:45 The audit trail

Click **Audit trail**.

Point at the two newest rows: the reveal by Demo Analyst and the suspension by Demo Enforcer, each with its reason.

Say: "The audit log is append-only. A database trigger refuses any update or delete, and no running service is even granted the right to try."

### 2:00 Done

Say: "The README maps every line of the job description to the file that shows it. It also lists what I did not build, and how each part would plug in."

## The 10-minute technical walkthrough

Do the 2-minute version first, a little faster. Then open the repository beside the console.

### 1. The split, in one file each (2 minutes)

| Show | Say |
|---|---|
| `apps/handlers/src/routes.ts` | "Every endpoint, one line each. Each route must name who may call it. There is no default, so a route cannot be exposed by forgetting." |
| `apps/handlers/src/router.ts`, `dispatch` | "Every request passes the same checks in the same order: origin, route, session, permission, handler. One place turns any error into the generic envelope." |
| `apps/core-api/config/routes.rb` | "Rails has five endpoints and a health check. None is reachable from outside the Docker network." |

### 2. The signed call (2 minutes)

| Show | Say |
|---|---|
| `packages/shared/fixtures/signing_vectors.json` | "Known inputs and their expected signatures. A script that shares no code with either side wrote them." |
| `apps/handlers/src/lib/core_api/signing.ts` | "Five parts joined by a newline. Without a separator, two different requests can produce the same string." |
| `apps/core-api/app/controllers/concerns/signed_request.rb` | "The order matters. The signature is checked before the nonce is stored, so a caller without the secret cannot fill the nonce table." |
| `apps/core-api/app/models/signed_request_nonce.rb` | "The insert is the check. Rails never selects first, because two requests arriving together would both find nothing." |

### 3. The read path with a fallback (2 minutes)

Sign in as Demo Analyst. Search the email `stats-gap-01` and open the account.

Point at the source line in the risk panel: some days came from the pre-aggregated table, and some were counted from raw events.

| Show | Say |
|---|---|
| `apps/handlers/src/lib/risk/load_risk.ts` | "Pre-aggregated rows first. A cheap probe then finds the newest event per day, from an index. Only the days that are missing or stale are counted from raw events." |
| `apps/handlers/src/lib/risk/merge_daily_counts.ts` | "A fallback day replaces the stats row and is never added to it, so no event is counted twice." |
| `apps/handlers/src/repositories/database.integration.test.ts`, the test "counts the same from raw events" | "This runs against real MySQL and proves both sources agree for every day both know." |

### 4. JSON columns and indexes (1 minute)

| Show | Say |
|---|---|
| `apps/core-api/db/migrate/20260930000003_create_accounts.rb` | "The signup context is a JSON column. Two generated columns pull the IP and the fingerprint out of it, and each has an index." |
| the integration test "looks a fingerprint up through the index" | "The test runs EXPLAIN and asserts the index name. I do not assume the index is used, I check." |

### 5. Least privilege, shown (1 minute)

| Show | Say |
|---|---|
| `apps/core-api/lib/database_grants.rb` | "The whole policy in one hash. Rails may update three columns of accounts and nothing else. The handlers hold SELECT only." |
| the integration tests under "what the handlers' database user cannot do" | "Nine statements, each refused by MySQL. TRUNCATE on the audit log is one of them." |

Optional, live:

```
docker compose -f docker-compose.dev.yml exec mysql mysql -utd_handlers -p trust_desk_development -e "UPDATE accounts SET status='suspended' WHERE id=1"
```

Expect: `UPDATE command denied to user 'td_handlers'`.

### 6. Lockdown (1 minute)

Sign in as Demo Enforcer. Click **Change mode**, pick **Lockdown**, give a reason, confirm.

A banner appears for every staff user. Open a suspended account: the unsuspend button is gone and a line says why.

Say: "The missing button is a courtesy. Rails is what refuses, and it reads the mode inside the same lock as the action."

Change the mode back to **Normal** before moving on.

### 7. What went wrong, and what I did not build (1 minute)

| Show | Say |
|---|---|
| `docs/bug-log.md` | "Three bugs, each with a regression test. The second one only a real browser could find: an API that exists in the test runner and not on a plain HTTP origin. The third one only the hardened production image could show." |
| `docs/decisions/005-pii-reveal-audit-writer.md`, "The gap that remains" | "The audit of a reveal is enforced in the handler path, not in the database. I wrote down how to close it and why I did not." |
| `README.md`, "Not built, on purpose" | "Bulk actions, the export, the chart, the LLM summary, Loki, and the abuse control registry. Each says how it would plug in." |
| `docs/ai-usage.md` | "What the AI generated, what it decided without me, and the mistakes it made." |

## Questions to expect

`docs/rails-interview-notes.md` has the answers, with the file behind each one. The five to rehearse:

1. What stops the read service from revealing PII without an audit row?
2. Why do two services share one database?
3. Why HMAC and not mutual TLS?
4. What breaks first at 100 times the data?
5. How much of this did you write?
