# Design note: Phase 1, walking skeleton

Written 2026-09-30, 06:25 UTC+8, before the work started.

## What

One thin path through every tier, running in Docker: sign in as an enforcer, list accounts by status, open one, suspend it with a reason, and see the audit row.

## Why

Every later feature hangs off four things that are hard to change once code depends on them: the schema, the signed call between the two services, the session, and the contract in `packages/shared`. This phase builds those four and proves them with one real action.

## How the work is split

The schema, the shared contract and the signing test vectors come first, written by the main agent. After that, three parts depend only on the contract, so they are built at the same time:

| Part | Built by |
|---|---|
| Rails: models, seed, signature check, suspend, audit | a subagent |
| Web: login, search list, account page, suspend dialog, audit trail | a subagent |
| Handlers: session, login, search, detail, audit trail, the signed client | the main agent |

The main agent reviews what the subagents produce and runs every test itself. This is recorded in `docs/ai-usage.md`.

## Files touched

- `apps/core-api/db/migrate/`: seven migrations, one table each
- `apps/core-api/lib/database_grants.rb`: the policy grows to cover the new tables
- `apps/core-api/app/`: models, one controller, one concern for the signature check, serializers, one service object
- `apps/core-api/db/seeds.rb` and `apps/core-api/db/seeds/`
- `packages/shared/src/schemas/`, `packages/shared/src/lib/`, `packages/shared/fixtures/`
- `apps/handlers/src/handlers/`, `src/repositories/`, `src/lib/auth/`, `src/lib/core_api/`
- `apps/web/src/`: pages, components, providers, the API client
- `e2e/tests/`

## Decisions taken in this note

Where two readings led to the same work I picked one. Each is open to change on the pull request.

1. **PII is masked for everyone in Phase 1.** Reveal arrives in Phase 2. Until then no group sees a raw email, IP or fingerprint, so the skeleton cannot leak by omission.
2. **Permissions, not groups, decide access.** A group maps to a list of permissions such as `accounts.enforce`. Code checks the permission. The map lives in one JSON fixture that the TypeScript tests and the Rails tests both read, so the two services cannot drift.
3. **The session is a stateless signed cookie** holding the staff user id, an issue time and an expiry, signed with HMAC-SHA256. It lasts 8 hours. Logout clears the cookie. A stolen cookie stays valid until it expires, which is the known cost of having no session table. The group is read from the database on every request, so a demotion takes effect at once.
4. **A row lock, not optimistic locking,** stops two enforcers acting on one account at once. Rails runs `SELECT ... FOR UPDATE` on the account inside the transaction, so the second request waits, then sees the new status and gets a 409.
5. **The signature headers** are `X-Signature`, `X-Signature-Timestamp` and `X-Signature-Nonce`. The timestamp is Unix seconds. The signature is lowercase hex.
6. **The reason is 10 to 500 characters.** Shorter than 10 is rarely a reason.
7. **Rails is granted UPDATE on three columns of `accounts` only:** `status`, `spam_marked_at` and `updated_at`. It cannot change an email.
8. **The seed doubles as the reset.** It truncates every table and rebuilds them from a fixed random seed, as the admin user.

## Tests

| Tier | What it proves |
|---|---|
| Jest, unit | signing matches the shared vectors; the session cookie rejects a tampered or expired value; masking; permissions match the fixture |
| Jest, handlers with a mocked database | login, search, detail and suspend: success, no session, wrong permission, bad input |
| Jest, against real MySQL | the search query and the detail query return what the seed put there |
| Rails, request tests for suspend | success, a bad signature, a replayed request, a stale timestamp, a missing reason, the wrong group, an account already suspended |
| Rails, signing | the verifier matches the shared vectors |
| Rails, database | UPDATE and DELETE on `audit_logs` both fail |
| React, Testing Library | the suspend dialog refuses a short reason and keeps the text after a failure; the login page signs in |
| Playwright | sign in, suspend an account, see the audit row |

## Rails concepts this phase introduces

- **Models and ActiveRecord.** A class per table. `Account` maps to `accounts` with no configuration, because Rails turns the class name into the plural table name.
- **Validations.** Rules on a model that run before a save, such as `validates :reason, length: { minimum: 10 }`. They are the Rails counterpart of a zod schema.
- **Associations.** `belongs_to :account` and `has_many :events` declare a foreign key and give you `event.account` and `account.events`.
- **Enums.** `enum :status, { active: "active", suspended: "suspended" }` gives `account.suspended?` and `Account.suspended`.
- **Controllers and strong params.** A controller action is a method. `params.expect(...)` lists the fields a request may set, and everything else is dropped.
- **Concerns.** A module mixed into a controller. The signature check lives in one, so every internal controller gets it by including a line.
- **`before_action`.** Runs a method before an action, and can stop the request. It is middleware scoped to a controller.
- **Transactions and row locks.** `account.with_lock do ... end` opens a transaction and locks the row until the block ends.
- **Service objects.** A plain Ruby class that holds one business operation. Rails has no folder for them by default. This app uses `app/services/`.
- **`rescue_from`.** Turns an exception class into a response in one place.
- **Seeds.** `db/seeds.rb` is a Ruby script run by `bin/rails db:seed`.
- **Raw SQL in a migration.** `execute` runs a statement Rails has no helper for, such as `CREATE TRIGGER`.
