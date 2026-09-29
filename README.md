# Trust Desk

A Trust and Safety investigation console: find an account, see why it is risky, act on it, and see who did what.

**This is a demo I built on my own initiative** for my application to a Software Developer, Trust & Safety Tooling (Full Stack) role. It is not a product and it has no real users.

**All data is synthetic.** Emails use `example.com` and `example.org`. IP addresses come only from the three ranges reserved for documentation: 192.0.2.0/24, 198.51.100.0/24 and 203.0.113.0/24.

**I learned Ruby and Rails during this build.** `docs/rails-learning-guide.md` is the record of that, and `docs/rails-exercises.md` holds the exercises I do myself.

**An AI agent generated most of the code**, from a brief I wrote and under rules I set. `docs/ai-usage.md` says what it generated, what it decided without me, and the mistakes it made.

The posting's examples of abuse are signup abuse, payment fraud, crypto mining and phishing hosting. From those I inferred a hosting or developer platform, and modelled one. That is my inference, not something the posting states.

## Run it

You need Docker and nothing else. No Node, no Ruby, no env file.

```
docker compose -f docker-compose.dev.yml up --build
```

Then open `http://localhost:5173`. The first start takes a few minutes. It migrates the database, applies the grants and loads the demo data by itself.

## Demo accounts

The login page lists them, each with a button that signs in with one click.

| Email | Group | May |
|---|---|---|
| `viewer@example.com` | viewer | read accounts and the audit trail, with PII masked. Filter by status |
| `analyst@example.com` | analyst | all of that, plus search by email, IP and fingerprint, and reveal PII with a reason |
| `enforcer@example.com` | enforcer | all of that, plus suspend, unsuspend, mark as spam and change the operational mode |

The password of all three is `trust-desk-demo-2026`. It is public on purpose: it guards synthetic data.

The demo data resets every day. Anyone can suspend every account, so a reset puts it back. The reset is `bin/rails db:seed`, which rebuilds the data from a fixed random seed. The audit log refuses DELETE, so the reset empties it with TRUNCATE, run by a database user that no running service uses. An append-only log with a reset sounds like a contradiction. The log is append-only for every service. The reset is an operator's action, and on a real system it would not exist.

## What to look at first

| Open | Sign in as | What it shows |
|---|---|---|
| `ring-01@example.com` | analyst | 12 accounts sharing one device fingerprint |
| `burst-01@example.org` | analyst | 15 signups from one IP inside an hour |
| `miner-01@example.com` | analyst | a crypto-mining pattern of CPU spikes |
| `phish-01@example.org` | analyst | a burst of abuse reports about phishing |
| `stats-gap-01@example.com` | anyone | the fallback read path: two days counted from raw events |

`docs/demo-script.md` has a 2-minute walkthrough and a 10-minute technical one.

## How each line of the job description maps to this code

Every line on the left is quoted word for word from `docs/job-description.md`.

### Responsibilities

| The posting says | What shows it | Where |
|---|---|---|
| "Build and maintain investigation UI: account search, detail views, event timelines, risk scoring, decision workflows, bulk actions and exports." | Search, the account page, the timeline, the risk panel and the enforcement dialogs are built. Bulk actions and exports are not, see below | `apps/web/src/pages/`, `apps/web/src/components/` |
| "Own the data endpoints behind those screens: query interpretation, search, stats and event aggregation, read paths over pre-aggregated tables with a log-platform fallback." | The risk read path uses `account_daily_stats` first and counts raw events only for days that are missing or stale. An integration test proves both sources agree | `apps/handlers/src/lib/risk/load_risk.ts`, `apps/handlers/src/repositories/queries/risk.ts` |
| "Extend the abuse control registry and its coverage and effectiveness models." | Not built. A sketch of how it would fit is below | "Not built, on purpose" |
| "Add and modify Rails API endpoints that power enforcement actions such as suspension, spam marking and operational mode changes." | Five signed endpoints: suspend, unsuspend, mark as spam, reveal audit, mode change | `apps/core-api/config/routes.rb`, `apps/core-api/app/services/` |
| "Ship with tests every time: Jest unit and component tests, handler tests with mocked DB and auth, and a regression test for every bug fix." | Jest for all TypeScript, handlers tested with the database and auth mocked, and every entry in the bug log names its regression test | `apps/handlers/src/test_utils/fake_deps.ts`, `docs/bug-log.md` |
| "Handle customer PII (emails, IPs, device fingerprints, decisions) with care: group-based access gating, input validation at boundaries, sanitized errors, signed service-to-service calls." | Masking on the server, a permission per route, zod at every boundary, one generic error envelope, HMAC with replay protection | `apps/handlers/src/lib/pii/`, `apps/handlers/src/routes.ts`, `apps/core-api/app/controllers/concerns/signed_request.rb` |

### Must-have requirements

| The posting says | What shows it | Where |
|---|---|---|
| "Strong TypeScript in strict mode and React 18 with hooks, React Query for server state, Tailwind and Radix primitives." | Strict mode with `noUncheckedIndexedAccess`, no `any` and no casts. React 18.3, TanStack Query, Tailwind 4, Radix Dialog | `tsconfig.base.json`, `apps/web/package.json` |
| "Ruby and Rails: comfortable reading and changing API controllers, serializers and model methods in a large codebase." | I learned it here. Every Rails file explains itself, and the guide follows one request through all of them | `docs/rails-learning-guide.md`, `docs/rails-exercises.md` |
| "Serverless functions (Request/Response style handlers) and SQL (MySQL, including JSON column querying)." | Each endpoint is `(req: Request, deps: Deps) => Promise<Response>`. Searches by IP and fingerprint use indexed generated columns over a JSON column, and a test runs `EXPLAIN` to prove it | `apps/handlers/src/types/handler.ts`, `apps/core-api/db/migrate/20260930000003_create_accounts.rb`, `apps/handlers/src/repositories/database.integration.test.ts` |
| "Log query languages (LogScale, Datadog or similar) for signal investigation." | Not built. Phase 6 would replace the fallback with LogQL on Grafana Loki | "Not built, on purpose" |
| "Security fundamentals: authn/authz, least privilege, secret handling, input sanitization, replay protection." | A signed session cookie, a permission per route, one database user per service with column-level grants, no secret in the repository, a nonce with a unique index | `apps/handlers/src/lib/auth/`, `apps/core-api/lib/database_grants.rb`, `apps/core-api/app/models/signed_request_nonce.rb` |
| "Testing discipline with Jest and a bias toward writing the test before declaring done." | Jest, not Vitest. Nothing in this repository was called done before its tests passed, and each pull request shows the output | the pull requests |
| "**Working with AI:** Uses AI coding agents (Claude Code, Cursor or equivalent) daily as a core part of the workflow, not as occasional autocomplete." | This repository was built that way, and says so | `docs/ai-usage.md` |
| "**Working with AI:** Knows how to direct an agent well: writes clear specs, breaks work into verifiable steps, reviews every generated diff critically and keeps tests as the gate. Never merges what they cannot explain." | The brief, the design notes per phase, one pull request per phase that only I merge | `docs/build-brief.md`, `docs/design-notes/` |
| "**Working with AI:** Maintains and improves agent context (rules files, skills, design gates) so the whole team gets faster, not just themselves." | `CLAUDE.md` holds the working rules, the locked decisions and every trap hit for real, with its error text | `CLAUDE.md` |
| "**Working with AI:** Can point to concrete examples of features shipped substantially faster with AI while keeping quality and security intact." | The core of this demo, three services with their tests, was built in one working day | the commit history |
| "Proactive: picks up gaps in coverage, flaky flows or unclear docs without waiting to be assigned." | The review of my own brief found that the `events` table had a column named `type`, which Rails reserves | `docs/ai-usage.md` |
| "Executes independently from a one-line problem statement to a reviewed, tested PR, and asks only when different readings would lead to materially different work." | The rule is written into the brief, and the design notes list what was decided without asking | `docs/build-brief.md`, section 1 |
| "Communicates concisely in PRs and chat, leads with the outcome, flags risks early." | Every commit and pull request starts with the outcome and names its risks | the commit history |
| "Treats bugs found along the way as things to fix or report, never things to walk past." | Three bugs found, all logged, each with a regression test | `docs/bug-log.md` |

Two must-haves are about me and not about code, "3+ years shipping production web software" among them. This repository cannot show those, so they are not in the table.

### Nice-to-have requirements

| The posting says | What shows it | Where |
|---|---|---|
| "Fraud, abuse or trust and safety domain experience (signup abuse, payment fraud, crypto mining, phishing hosting)." | The seed builds one cluster per pattern, and the risk score has a rule for each | `apps/core-api/db/seeds/`, `apps/handlers/src/lib/risk/risk_config.ts` |
| "AWS RDS Data API, Aurora." | Not built. The handlers reach MySQL only through named query functions, so a second implementation on the Data API would not touch a handler | `apps/handlers/src/interfaces/deps.ts` |
| "Data visualization (time series, maps, funnels) in React." | Not built. Phase 3 is a risk trend chart | "Not built, on purpose" |
| "Experience running or tuning LLM-backed features safely in production." | Not built. Phase 5 is a case summary behind a human approval gate | "Not built, on purpose" |

## Architecture

```
Browser (React 18 SPA)
   |  same origin
host nginx (TLS) --> web container (static build)
                 \-> /api/* --> handlers container (TypeScript Request/Response handlers)
                                  | reads  --> MySQL 8
                                  | writes --> core-api container (Rails, API-only)
                                               [HMAC-signed, internal network only]
                                                  \-> MySQL 8
```

| Part | Path | Job |
|---|---|---|
| Web | `apps/web` | The console. React 18, TanStack Query, Tailwind, Radix |
| Handlers | `apps/handlers` | Every read. The only service the browser talks to |
| Core API | `apps/core-api` | Every enforcement write. Rails, never public |
| Shared | `packages/shared` | The zod schemas and the fixtures both sides are tested against |
| End to end | `e2e` | Playwright |

### Two services share one database

That is a trade-off, and I accepted it because the posting describes that split. It makes the schema a contract between two codebases. What keeps the contract honest:

- Rails owns every migration. The handlers never change the schema.
- Each service has its own database user. The handlers hold SELECT only.
- Every handler query runs against real MySQL in a test, so a renamed column fails a test.
- The shapes that cross between the services are pinned by fixtures that both test suites read.

## Decisions

| ADR | Decision | How it was decided |
|---|---|---|
| [001](docs/decisions/001-typescript-data-access.md) | Raw SQL with `mysql2` and zod, no query builder | A council of three advisors and a chair |
| [002](docs/decisions/002-rails-serializers.md) | Plain Ruby serializers | The default from the brief |
| [003](docs/decisions/003-rails-test-framework.md) | Minitest | By me. The posting names no Rails test framework |
| [004](docs/decisions/004-nonce-store.md) | Nonces in a MySQL table | The default from the brief |
| [005](docs/decisions/005-pii-reveal-audit-writer.md) | Rails writes the audit row for a PII reveal | A council of three advisors and a chair |

## Run the tests

```
docker compose -f docker-compose.dev.yml run --rm install pnpm run test
docker compose -f docker-compose.dev.yml run --rm handlers sh -c "cd /repo && pnpm --filter @trust-desk/handlers run test:integration"
docker compose -f docker-compose.dev.yml run --rm -e RAILS_ENV=test migrate sh -c "bin/rails db:test:prepare && bin/rails test"
docker compose -f docker-compose.dev.yml --profile e2e run --rm e2e
```

| Tier | Runs against | Proves |
|---|---|---|
| Jest, unit | nothing | the risk rules, masking, signing, the session cookie, the throttle |
| Jest, handlers | a mocked database and auth | each endpoint's answers, and what it must refuse |
| Jest, integration | real MySQL, as the handlers' database user | that the SQL is valid, uses its indexes, and that nine statements are refused |
| Minitest | real MySQL | the signature check, each enforcement action, the append-only trigger |
| Testing Library and jest-axe | jsdom | the dialogs, the permission-aware buttons, accessibility |
| Playwright | the whole stack, in a real browser | the demo script, step by step |

## Security notes

| Concern | What is done | What is not |
|---|---|---|
| Access | A permission per route, checked in one place. A route with no `access` does not compile. Rails checks the permission again | |
| PII | Masked on the server for every read. A reveal needs a permission and a reason, and leaves an audit row | The audit of a reveal is enforced in the handler path, not in the database. See ADR 005 |
| PII search | Searching by email, IP or fingerprint needs a permission a viewer does not hold | |
| Sessions | A signed cookie: HttpOnly, SameSite=Strict, and Secure on HTTPS. An origin check on every state-changing request | The cookie is stateless. A copy taken before logout stays valid until it expires, 8 hours at most |
| Login | One answer for a wrong password and an unknown email. Failures counted per IP, never per account | The count lives in process memory and resets on restart. nginx limits the endpoint as well |
| Service to service | HMAC-SHA256 over method, path, timestamp, nonce and body hash. A 60-second window. A nonce with a unique index | The traffic is plain HTTP on a private Docker network. It is signed, not encrypted |
| Replay | The nonce stops a repeated request. The idempotency key stops a repeated intent | |
| Database | One user per service. Column-level UPDATE for Rails. SELECT only for the handlers. Rails and MySQL publish no port | |
| Audit log | Append-only in three layers: a trigger, the grants, and the model | The daily reset truncates it, as the admin user |
| Errors | One generic envelope with a correlation id. A stack trace or SQL never reaches a client | |
| Logs | Ids only. Tests check the log output for values that must not be there | At debug level the Rails development log holds SQL with values. Production logs at `info` |
| Secrets | None in the repository. gitleaks runs in CI | Development values sit in the Compose file, and each says `not-a-secret` |
| Dependencies | Exact pins. pnpm refuses a package published less than a day ago. Every install script is denied | |
| Containers | In production: read-only filesystems, every capability dropped, a memory limit on each | MySQL keeps four capabilities, which its entrypoint needs |

## Not built, on purpose

The core came first. What follows was planned and not built. Each entry says how it would plug in.

### Risk trend chart

A 30-day time series of the score and its signals per account, with Recharts.

**How it would plug in:** `account_daily_stats` already holds one row per day. A new handler would call the existing `compute_risk_score` once per day and return the series. The chart needs a text alternative, a table of the same numbers, for a screen reader.

### Bulk actions and CSV export

Multi-select in the search results, a Rails bulk endpoint, and a streamed CSV export.

**How it would plug in:** the bulk endpoint would call the existing enforcement service once per account and answer with one result per account, since one failure should not undo the others. It would take a maximum batch size and one idempotency key for the batch. The export would pass every row through the existing masking module, and would prefix any cell starting with `=`, `+`, `-` or `@` with a single quote, so a spreadsheet does not run it as a formula. The permission `accounts.bulk_enforce` already exists.

### LLM case summary with an approval gate

A summary of an account's timeline, written by a model, that an analyst approves, edits or rejects.

**How it would plug in:** the handlers would replace every email, IP and fingerprint with a token before anything leaves the server, call the Anthropic API with the model id from the environment and a prompt versioned in the repository, and store the answer with the status SUGGESTED. Only an approved summary would attach to a case. A summary could never trigger enforcement: the enforcement endpoints take a reason typed by a person and nothing else. Since the demo is public, it would need a daily request limit, a token limit per request and a switch to turn it off.

The data model has no case yet. A case would be one investigation of one account, with its own table, written by Rails.

### Log-platform fallback on Loki

Events shipped to Grafana Loki, and the fallback read path answered by LogQL.

**How it would plug in:** `count_events_for_days` is the one function that counts raw events. A second implementation would send a LogQL query to Loki's query API and return the same shape, so no handler would change. Labels would stay low in cardinality: `account_id` would never be a label, and a query would filter with `| json | account_id="..."`. Loki would need a strict memory limit on a server this small.

### Abuse control registry, with coverage and effectiveness models

The posting asks for this and I did not build it.

**What I understand it to be:** a list of the controls the platform has against abuse, such as "block signups from disposable domains" or "flag a fingerprint shared by more than five accounts". For each control, which abuse patterns it covers, and how well it works.

**How it would fit here:**

- A table `abuse_controls`, one row per control, with the patterns it addresses.
- The risk signals in `risk_config.ts` are already seven small controls. Each would become a row.
- **Coverage** would be a matrix of patterns against controls, showing which patterns have no control at all.
- **Effectiveness** would compare what a control flagged with what analysts then decided. Precision is the share of flagged accounts that were suspended. Recall is the share of suspended accounts that the control had flagged. Both are counts over `enforcement_actions` and the score's signals, so the data to compute them is already stored.
- A page in the console would show the matrix and the two numbers per control, and an analyst could see which control produces the most false alarms.

## AI usage, in short

| | |
|---|---|
| Agent | Claude Code, working toward a stated goal, with two conditions under which it had to stop and wait |
| My part | The brief, the rules, the architecture, the security requirements, and the review of every pull request |
| Decisions | Real trade-offs went to a council. Each verdict is an ADR that says where the advisors disagreed |
| Subagents | Two, for Rails and for the web console, each confined to one directory with no git access. Their reports were checked by running everything again |
| Mistakes | Written down, not hidden. See `docs/ai-usage.md` and `docs/bug-log.md` |
| Merging | By me only |

## More

- `docs/build-brief.md`: the full brief
- `docs/demo-script.md`: the 2-minute and the 10-minute walkthrough
- `docs/rails-learning-guide.md`: Ruby and Rails, explained through this code
- `docs/rails-exercises.md`: eight exercises I do myself
- `docs/rails-interview-notes.md`: likely questions, with answers and file paths
- `docs/deploy-runbook.md`: how to deploy beside another site without disturbing it
- `docs/env-reference.md`: every environment variable
- `docs/bug-log.md`: every bug and the test that now catches it
- `docs/ai-usage.md`: what the AI generated and what I changed
