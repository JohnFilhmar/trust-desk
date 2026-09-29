# Interview notes

Questions an interviewer is likely to ask about this code, each with a short answer and the file that backs it. The uncomfortable ones come first, since those are the ones worth rehearsing.

Answer in my own words. These notes are the facts, not a script.

## The uncomfortable ones

### What stops the read service from revealing PII without an audit row?

Nothing in the database. That is the honest answer.

The audit is enforced in the handler path. The handler asks Rails to write the row, and puts raw values in the response only after Rails answers that the row exists. If Rails is down, the handler answers 503 and reveals nothing. A test covers each of those cases.

But the handlers' database user holds SELECT on the raw columns. It has to, because it searches by email and IP and computes the masked form. So a compromise of that service bypasses the audit.

The fix is to move the control to the layer that holds the data: revoke SELECT on the raw columns, serve masked values from a view, and reveal through one stored procedure that inserts the audit row and returns the values. I wrote that down and did not build it, because it changes the split between the two services and I had hours, not days.

Where: `docs/decisions/005-pii-reveal-audit-writer.md`, `apps/handlers/src/handlers/reveal_account_pii.ts`.

### Why do two services share one database?

Because the posting describes that split: a TypeScript layer that reads pre-aggregated tables, and a Rails API for enforcement. I built what the team runs, not what a textbook recommends.

What it costs: the schema is a contract between two codebases, and a migration in Rails can break a query in TypeScript without either test suite noticing.

What I did about it:

- Rails owns every migration. The handlers never change the schema.
- Each service has its own database user. The handlers hold SELECT only, and an integration test proves nine statements are refused.
- Every handler query runs against real MySQL in a test, so a renamed column fails a test.
- The shapes that cross between the services are pinned by fixtures that both test suites read.

At a larger scale I would put the read side behind its own store, fed by events from the write side.

Where: `apps/core-api/lib/database_grants.rb`, `apps/handlers/src/repositories/database.integration.test.ts`.

### Why HMAC and not mutual TLS?

mTLS authenticates the connection. It needs a certificate authority, certificates for both services, and a way to rotate them. For two containers on one private Docker network, that is a lot of machinery.

HMAC authenticates each request. It also gives me two things mTLS does not: the body is covered, so it cannot be changed in flight, and the timestamp and nonce stop a captured request from being sent again.

What HMAC does not give me: encryption. The traffic between the two containers is plain HTTP. On one host's private network I accepted that. Across hosts I would not.

In production I would use both: mTLS or a service mesh for the channel, and a signed request for the intent.

Where: `apps/core-api/lib/request_signature.rb`, `apps/handlers/src/lib/core_api/signing.ts`.

### What breaks first at 100 times the data?

In order:

1. **Search by email fragment.** It uses `LIKE '%text%'`, which reads every row. At 30,000 accounts it is slow. At 3 million it is unusable. It needs a full-text index or a search service.
2. **The quick risk score of a list.** Two correlated subqueries per row count accounts sharing a fingerprint and an IP. They use indexes, but a fingerprint shared by 10,000 accounts makes each count expensive. I would store those two counts and update them when an account signs up.
3. **The fallback aggregation.** It counts raw events for stale days. With millions of events per account that belongs in the log platform, which is what Phase 6 is for.
4. **The nonce table.** One insert and one delete per signed call. Redis would do it faster and expire keys by itself.
5. **The audit log.** It only grows. It would need partitioning by month.

What holds up: keyset pagination costs the same on page 1 and page 10,000, and searches by IP and fingerprint are index lookups.

Where: `apps/handlers/src/repositories/queries/accounts.ts`, `apps/handlers/src/repositories/queries/risk.ts`.

### What would you do differently?

- Deploy first. I put the deploy at the end, and that left DNS, the certificate and the server's memory untested until the last hours.
- Close the reveal gap in the database, as described above.
- Add a session table. The cookie is stateless, so a copy taken before logout stays valid for up to 8 hours.
- Test the row lock with two real threads. Today a test changes the row behind a loaded record and checks that the service still refuses.
- Put the login throttle in a shared store. It lives in process memory, so it resets on restart and would not work on Lambda.

### How much of this did you write?

An AI agent generated most of the code, from a brief I wrote and corrected. `docs/ai-usage.md` lists what it generated in each phase, what it decided without me, and the mistakes it made and caught.

What I did: wrote the brief, fixed its contradictions, set the rules the agent works under, chose the architecture and the security requirements, decided where a council of advisors was worth running, and reviewed every pull request.

What I can do now that I could not before: read a Rails controller, a model, a migration and a service object, and say what each line does. The exercises in `docs/rails-exercises.md` are the ones I did myself.

I merged nothing I could not explain.

## Security

### Walk me through the signature check

The handlers build a string from five parts joined by newlines: the method, the path with its query string, a Unix timestamp, a nonce, and the SHA-256 of the body. They sign it with HMAC-SHA256.

Rails checks, in this order:

1. The three headers have the right format.
2. The timestamp is within 60 seconds of now, in either direction.
3. The signature matches, compared in constant time.
4. The nonce is new.

The signature comes before the nonce on purpose. If the nonce were stored first, anyone could fill the table without knowing the secret.

The newline matters. Without a separator, the path `/a1` followed by timestamp `23` produces the same string as `/a` followed by `123`.

Both implementations are tested against one file of vectors written by a script that shares no code with either.

Where: `apps/core-api/app/controllers/concerns/signed_request.rb`, `packages/shared/fixtures/signing_vectors.json`.

### Why compare in constant time?

`==` on two strings stops at the first byte that differs. So a comparison that fails on byte 1 returns sooner than one that fails on byte 30. An attacker who can measure that can recover a valid signature byte by byte. `secure_compare` takes the same time wherever the difference is.

### How do you stop a replay?

Two layers, for two different things.

- **The nonce** stops the same signed request from being accepted twice. It is stored with a unique index. Rails inserts and rescues the uniqueness error. It never checks first, because two requests arriving together would both find nothing.
- **The idempotency key** stops the same intent from acting twice, when a browser retries with a fresh signature. The key sits in the signed body, so the signature covers it.

### Why does Rails check the permission again?

The router in the handlers already checked it. Rails checks it again from the staff user id inside the signed body, loading the user and reading the group from the database. It never trusts a group the caller sent.

If the handlers had a bug in their access check, Rails would still refuse. That is the point of doing it twice.

### What is in the logs?

Ids, never PII. Account ids and staff user ids, the correlation id, the status, the duration. Never an email, an IP, a fingerprint, a password, a cookie or a signature.

The handlers log the path without its query string, because a search by email puts the email in the query string.

Tests check the log output of a login, a search and a reveal for the values that must not be there.

### How does masking work?

On the server, in one module. A raw value never reaches a browser that may not see it.

| Field | Masked form | Why this much |
|---|---|---|
| Email | `j***@example.com` | The domain is itself a risk signal |
| IP | `192.0.2.xxx` | Enough to see that two accounts share a network |
| Fingerprint | `fp_a1b***` | Two accounts that share one still look alike |
| User agent | `Mozilla/5.0 ***` | The product token only |

Event payloads are free-form JSON, so PII can sit under any key. Two nets catch it: known keys are masked by their own rule, and every other string is searched for emails and IPv4 addresses.

Where: `apps/handlers/src/lib/pii/mask.ts`, `mask_payload.ts`.

### Why can a viewer not search by email?

Because masking would then hide nothing. A viewer could type a guess and learn from the result count whether it was right.

A viewer who tries gets 403, not an empty list, so a refusal is not mistaken for "no match".

## Rails

### What is the difference between `find` and `find_by`?

`find(42)` raises `ActiveRecord::RecordNotFound` when nothing matches. `find_by(id: 42)` returns nil. This app uses `find_by` and answers 404 itself, so every error goes through one method and has one shape.

### What is an N+1 query and where could this app have one?

Loading a list, then running one more query per item. The audit trail shows the actor's name on every row. Loading 50 rows and then calling `row.staff_user.display_name` on each would run 51 queries.

The handlers avoid it with a JOIN. In Rails the fix is `AuditLog.includes(:staff_user)`, which loads all the staff users in one query.

### Callbacks or service objects?

A callback runs on every save from anywhere, and nothing at the call site shows it. I use one, to strip spaces from a reason before its length is checked.

A business step such as "write the audit row" lives in a service object, where it reads top to bottom and a test can call it directly.

### Why `save!` and not `save`?

`save` returns false on failure. `save!` raises. Inside a transaction only an exception rolls back. With `save`, a failed write would return false, the block would carry on, and the transaction would commit the other two writes.

### What does `with_lock` do?

Opens a transaction, runs `SELECT ... FOR UPDATE` on that one row, and reloads the record. A second request for the same row waits until the first block ends.

The status is checked inside the block. Before the lock, the value in memory could already be out of date.

### Are your migrations reversible?

Eight of nine use `change`, and Rails works out the reverse. The audit log migration creates two triggers with raw SQL, which Rails cannot reverse by itself, so it has `up` and `down` written out.

### Why `structure.sql`?

`schema.rb` is Ruby and can describe tables and indexes. It cannot describe a trigger. The test database is built from the schema file, so with `schema.rb` it would have no append-only trigger and the test that proves UPDATE fails would fail itself.

## TypeScript and the handlers

### Why plain functions and not a framework?

The posting describes "Request/Response style handlers". Each endpoint is `(req: Request, deps: Deps) => Promise<Response>`, using the web-standard types. The Node adapter that serves them is one file. On Lambda, that file is the only part that changes.

Everything a handler needs from outside comes through `deps`, so a test passes a fake and needs no network, no database and no clock.

### Why no query builder?

I ran it past a council of advisors and all three said the same thing. A query builder's types would be a hand-written copy of a schema Rails owns. zod is still needed at runtime. And the posting asks for SQL, so SQL is what an interviewer should be able to read.

Where: `docs/decisions/001-typescript-data-access.md`.

### How does keyset pagination work, and why not OFFSET?

`OFFSET 10000` makes the database read 10,000 rows and throw them away. Keyset pagination remembers the last row of the page and asks for what comes after it, so every page costs the same.

The cursor holds `created_at` and `id`. The id breaks ties between rows created in the same microsecond.

One trap I hit: Rails stores `datetime(6)`, and a JavaScript Date keeps milliseconds. A cursor built from a Date would skip or repeat rows. The driver returns the timestamp as text, and the cursor keeps all six digits.

### How do you know the index is used?

A test runs `EXPLAIN` and asserts the key name and that there is no filesort.

Where: `apps/handlers/src/repositories/database.integration.test.ts`.

## The risk score

### Why not machine learning?

An analyst has to be able to say why an account was flagged, to a colleague and sometimes to the customer. Every point of this score traces to a number: "11 other accounts signed up with the same device fingerprint". A model gives a score and a shrug.

Rules are also testable. Each one has a test with a number in it.

### Why is there only one implementation?

The first draft had the seed compute a score in Ruby and the handlers compute one in TypeScript. Two implementations drift. Now the pre-aggregated table stores counts, never a score, and one pure TypeScript function turns counts into a score. Ruby never computes one.

### What is the fallback?

The score reads the pre-aggregated table first. A cheap probe then finds the newest event per day from an index. Any day with events and no stats row, or with a row older than its newest event, is counted from raw events. Only those days.

An integration test proves the two sources agree for every day both know.

The response says how many days came from each source.

## Process

### How do you work with an AI agent?

- I write the spec first, and I fix its contradictions before any code exists. The first review of my brief found that the `events` table had a column named `type`, which Rails reserves.
- The agent works under written rules: tests are the gate, every bug gets a regression test, nothing is claimed without running it.
- Real trade-offs go to a council, and the verdict is recorded with where the advisors disagreed.
- I review on pull requests, one per phase, and I merge.
- I keep the agent's context current. `CLAUDE.md` lists traps that were hit for real, with the error text.

### Give me an example of the agent being wrong

It wrote a bcrypt hash by hand as a placeholder and called it valid. It could not know that. An invalid hash is refused at once, which would have reopened the timing gap the placeholder exists to close. It caught that itself and generated a real hash at startup.

It also wrote in the learning guide that a middleware parses the JSON body. Running `bin/rails middleware` showed that none does.

Both are in `docs/ai-usage.md`.
