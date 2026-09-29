# Build brief: Trust & Safety investigation console (demo)

Working name: `trust-desk`. Live target: `https://trust.filhmar.online`.

## 0. Context

I'm John Filhmar Ola, a full-stack engineer. I'm strong in TypeScript, React and Node.js, with working knowledge of Python, Go and Java. I'm building this demo for my interview for **Software Developer, Trust & Safety Tooling (Full Stack)**. That role owns the fraud and security surfaces of an internal operations platform: investigation dashboards, account risk views, enforcement workflows and the backend services behind them, across a React front end, a TypeScript serverless layer and a Ruby on Rails core API.

The purpose of this demo is to show that I researched what this team needs and can ship it. Every feature must map to a line in the job description, and the README must show that mapping.

**The job description** is in `docs/job-description.md`, pasted by me word for word. Quote its lines exactly in the mapping table. If that file is missing or empty, stop and ask me for it. Never invent, paraphrase or guess a job description line.

**Deadline:** live at the URL above by 2026-09-30, 17:00 UTC+8. Core first. Extras only after the core is live and tested.

**Priorities, in this order.** When two of them conflict, the lower one gives way.

1. A working core, live at the URL, by the deadline.
2. Rails code and docs that I can study and explain.
3. The extras in Phases 3 to 6.

**Ruby on Rails is new to me, and so is Ruby itself.** I'm learning both from scratch through this project. I'm fluent in programming fundamentals (OOP, HTTP, REST, SQL, MVC, testing, auth), so don't explain those. Do explain everything specific to Ruby and to Rails. See section 6.

**My machine:** Windows 11 with Docker Desktop, Node 22, PowerShell and Git Bash. Ruby is not installed, and I want to keep it that way. Every Ruby and Rails command runs in a container, including `rails new`. The repository path contains a space (`D:\My Folder\trust-desk`), so quote paths in every script and command.

My reference project: https://github.com/JohnFilhmar/real-time-equity-trade-blotter. Use it only as inspiration for how I structure a repository, README, decision records, test tiers, hardened Docker Compose and same-origin routing. **Ignore its CLAUDE.md completely and do not copy its code.** This project has its own CLAUDE.md, already in the repository root.

## 1. How we work (non-negotiable)

1. Read this whole brief and CLAUDE.md, then reply with a plan for Phase 0 and Phase 1, the decisions you want to take to the council, anything ambiguous, and every place where this brief contradicts itself or CLAUDE.md. **Write no code until I approve.**
2. **Design gates:** at the start of every phase, write a short design note (what, why, files touched, tests you'll write) and wait for my approval. Keep the note under one page. Put every question for the phase in that one note, so I answer once.
3. **Tests are the gate.** Write or outline the tests before the implementation where practical. A phase is not done until its tests pass and you've shown me the command output. Never claim something works without running it.
4. **Every bug gets a regression test.** If you find a bug along the way, write a failing test first, fix it, and log it in `docs/bug-log.md`. Never walk past a bug.
5. **I must be able to explain every line.** Keep changes small and reviewable, commit per step with clear messages, and lead every commit or PR description with the outcome, flagging anything risky or non-obvious.
6. **One branch and one pull request per phase.** I merge. Put no AI attribution in commits, pull requests or file headers. The AI record lives in `docs/ai-usage.md`.
7. **Keep the AI record as you go.** After each phase, append to `docs/ai-usage.md` what you generated, with a placeholder for what I changed or rejected. I keep `docs/prompt-log.md` myself.
8. **Dependencies:** the ones listed in section 3 are approved. Ask before adding any other. Pin exact versions.
9. Ask only when different readings would lead to materially different work. Otherwise pick the sensible option and note it.
10. Write docs in plain English, with no em dashes.
11. **Watch the clock.** Follow the time budget below. If a checkpoint slips by more than an hour, stop and tell me what you would cut. Don't work past it quietly.

### Time budget

This is my first proposal. I'll correct the times at the first gate to match the hours I can work.

| Checkpoint | Time (UTC+8) |
|---|---|
| Phase 0 approved and merged | 2026-09-29, 23:59 |
| Phase 1 skeleton live at the URL | 2026-09-30, 10:00 |
| Feature freeze for Phase 2 | 2026-09-30, 14:30 |
| README, demo script and smoke test against the live URL finished | 2026-09-30, 16:30 |
| Deadline | 2026-09-30, 17:00 |

## 2. Decisions: use the LLM council

For decisions with real trade-offs, run the installed skill `/llm-council` (for example: "run the council on: <decision, options, constraints>"). Then record an ADR in `docs/decisions/NNN-title.md` with: context, options, the council's verdict (where the advisors agreed and disagreed), my final decision, and consequences. The council advises; I decide at the design gate.

Use it for at most 5 decisions. Good candidates, each with the default I lean toward:

- TypeScript data access: raw SQL with `mysql2` vs a typed query builder such as Kysely. Default: raw `mysql2` with prepared statements and rows parsed by zod.
- Rails serializers: a gem vs plain Ruby serializer objects. Default: plain Ruby objects, since they hide nothing from a learner.
- Rails tests: Minitest (the default) vs RSpec. Default: Minitest, unless the job description names RSpec.
- Nonce store for replay protection: a MySQL table vs Redis. Default: a MySQL table, since Redis adds a container to a server that's already shared.
- Who writes the audit row for a PII reveal: the handlers with a narrow INSERT grant, or Rails through a signed call so the audit table has one writer.

Bulk action semantics are already decided in Phase 4: per-account results. Don't council that.

Run the councils during Phase 0 while the scaffold builds. Every ADR names a default, so a slow or failed council run never blocks a phase. Don't council trivial choices.

## 3. Architecture (fixed; mirrors the team's split)

```
Browser (React 18 SPA)
   |  same origin: https://trust.filhmar.online
host nginx (TLS) --> web container (static build)
                 \-> /api/* --> handlers container (TypeScript Request/Response handlers)
                                  | reads  --> MySQL 8 (pre-aggregated tables, raw events, JSON columns)
                                  | writes --> core-api container (Rails, API-only)
                                  |            [HMAC-signed, internal Docker network only]
                                                  \-> MySQL 8 (enforcement, audit log)
```

- **Frontend (`apps/web`):** React 18 (not 19, to match the team), Vite, TypeScript in strict mode, TanStack Query for server state, Tailwind CSS, and Radix UI primitives (Dialog, DropdownMenu, Checkbox, Tooltip, Tabs). Built for a desktop browser at 1280 px and wider. No mobile layout. In development, the Vite server proxies `/api` to the handlers so the browser stays on one origin.
- **TypeScript serverless layer (`apps/handlers`):** every endpoint is a plain function `(req: Request, deps: Deps) => Promise<Response>` using the web-standard Request and Response, one file per handler, with the database, auth and clock injected through `deps`. A thin Node adapter serves them on EC2, but the handlers themselves must stay portable to AWS Lambda. This layer owns **reads** (search, account detail, timeline, stats, risk) and is the only service the browser talks to. Anything held in process memory, such as login rate-limit counters, would not survive a move to Lambda. Mark each such spot with a comment that names the limit and the replacement.
- **Rails core API (`apps/core-api`):** Rails in API-only mode with the MySQL adapter. Owns **writes and enforcement**: suspend, unsuspend, mark as spam, operational mode changes. Never exposed publicly; reachable only on the internal Docker network, and only through signed calls from the handlers layer.
- **Shared contract (`packages/shared`):** zod schemas for every request and response between the browser and the handlers, with TypeScript types derived from them.
- **Contract between the handlers and Rails:** zod schemas in `packages/shared` also cover every Rails response the handlers parse. JSON fixtures in `packages/shared/fixtures` feed both the Jest tests and the Rails tests, so a change on one side fails a test on the other.
- **Database:** MySQL 8. Rails migrations own the schema; the handlers read it. Two services sharing one database is a trade-off, and the README says so and explains why I accepted it.
- **JSON field names** are snake_case from both services. The web app reads them as they arrive, with no renaming layer.
- **Time:** UTC in the database, in Rails and in the handlers. The browser converts for display. A day in `account_daily_stats` is a UTC day.
- **Errors:** one envelope for every failure, defined once in `packages/shared`: `{ "error": { "code", "message", "correlation_id" } }`.
- **Health:** `GET /api/health` on the handlers and the built-in `GET /up` on Rails. Neither needs a session or a signature. Compose health checks use them, and each service waits for MySQL to be healthy before it starts.
- **When Rails is down or slow:** the handlers call Rails with a 3-second timeout and never retry on their own. Reads keep working. The enforcement dialog shows a clear error and keeps the reason the analyst typed.
- **Tooling:** pnpm workspaces for the TypeScript parts; the Rails app lives alongside them in the monorepo.

**Approved dependencies.** Use one only when the work needs it.

- Web: React Router 6, TanStack Query, Tailwind CSS, Radix UI primitives, zod, Recharts (Phase 3), Jest, Testing Library, jest-axe.
- Handlers: `mysql2`, zod, `bcryptjs`, `pino`, and Kysely only if its ADR picks it.
- Rails: `mysql2`, `puma`, `bcrypt`, `debug`, RuboCop with the Rails defaults, Brakeman, bundler-audit.
- End to end: Playwright.

## 4. Domain and data

The posting's abuse examples (signup abuse, payment fraud, crypto mining, phishing hosting) point to a hosting or developer platform, so model that, and state in the README that this is my inference.

Table names follow Rails pluralization. Fighting that convention costs more than it teaches.

- **staff_users** (the people who use the console): email, `password_digest`, `group_name` (viewer, analyst, enforcer). Rails seeds them through `has_secure_password`, which writes bcrypt hashes. The handlers verify those hashes at login. Don't name the column `group`, which is a reserved word in SQL.
- **accounts:** id, email, status (active, suspended), `spam_marked_at`, plan, created_at, and a `signup_context` JSON column (ip, country, user_agent, device_fingerprint, referral).
- **events** (the raw log): account_id, `event_type` (signup, login, login_failed, payment, payment_failed, deploy, cpu_spike, abuse_report, api_burst), occurred_at, and a `payload` JSON column. Don't name the column `type`. Rails reserves that name for single-table inheritance and will try to load a class named after each value. Add generated columns with indexes for hot JSON paths (for example the device fingerprint), and show JSON column querying in at least one handler.
- **account_daily_stats** (pre-aggregated): per account, per UTC day, the signal counts plus `computed_at`. It stores counts, not a score. Read paths use this table first and fall back to aggregating raw events when a day is missing or stale. A day is stale when the account has an event on that day newer than `computed_at`. Label this in code and docs as the log-platform fallback; Phase 6 replaces it with Loki.
- **enforcement_actions**, **audit_logs** (append-only: a MySQL trigger rejects UPDATE and DELETE, and no runtime database user holds UPDATE or DELETE on the table) and **operational_modes** (normal, elevated, lockdown; each change is a new row, and the current mode is the newest row).

**Enforcement rules.**

- Suspend moves an account from active to suspended. Unsuspend moves it back. Mark as spam sets `spam_marked_at` and leaves the status alone.
- An action that doesn't fit the current state returns 409 with a specific error code, such as `already_suspended`.
- The status change, the enforcement action and the audit row are written in one database transaction. Either all three exist or none does.
- Two enforcers acting on one account at the same moment must not both succeed. Use a row lock or optimistic locking, and explain the choice in the learning guide.

**Operational mode effects.** A mode that changes nothing is only a label, so each mode changes one behavior that a test can observe. My proposal, to confirm at the Phase 2 gate:

- `normal`: standard behavior.
- `elevated`: the score at which search flags an account for review drops, and the console shows a banner.
- `lockdown`: unsuspend is refused with its own error code, and the banner says why.

**Risk score.** Rule-based and explainable, not machine learning. Use weighted signals such as failed payment rate, a device fingerprint shared across accounts, CPU spikes, abuse reports, disposable email domains and signup velocity from one IP. Every score returns its contributing signals so an analyst can see why.

- One implementation only: a pure TypeScript function that turns counts into a score from 0 to 100 plus a band (low, medium, high). Ruby never computes a score, so the two services can't disagree.
- Weights and thresholds live in one config file, covered by unit tests.
- Signals that span accounts, such as a shared fingerprint or signup velocity from one IP, need their own queries. Say in the design note where each one is computed.

**Synthetic data only.** Emails on `example.com` or `example.org`, and IPs only from the RFC 5737 documentation ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24). Seed about 300 accounts over 30 days with a realistic mix: mostly clean accounts, plus clusters showing each abuse pattern (for example 12 accounts sharing one fingerprint, a crypto-mining CPU pattern, and a burst of phishing reports).

- The seed is deterministic. It uses a fixed random seed, so the same accounts and clusters appear on every run and the demo script can name them.
- Dates are relative to the day the seed runs, so the data never looks old.
- The seed leaves some days out of `account_daily_stats` on purpose and makes a few rows stale, so the fallback path runs in the demo and in tests.
- One documented command resets the database to the seeded state. See section 8.

## 5. Security and PII

The team calls these out explicitly, so treat them as requirements:

- **Users and groups:** seeded demo users in three groups. `viewer` sees masked PII and is read-only. `analyst` can reveal PII per account, and every reveal is audited. `enforcer` has analyst access plus enforcement, bulk actions and mode changes. Enforce this server-side in every handler and every Rails action; the UI only mirrors it.
- **Masking:** the handlers mask on the server, so unmasked values never reach a browser that may not see them. Write the rule for each field (email, IP, fingerprint, user agent) in one module with unit tests. Event `payload` JSON can carry IPs and emails too, so the timeline and the CSV export pass through the same module.
- **Search must not leak what masking hides.** If a `viewer` can search by email fragment or IP, the result count confirms a guess even when the field is masked. By default only `analyst` and `enforcer` may search by email, IP or fingerprint, and `viewer` searches by status and risk band.
- **PII reveal:** a POST that returns the unmasked fields for one account and writes an audit row with the actor, the account, the fields and the correlation ID. The browser keeps revealed values in memory only, never in local storage. Propose at the gate whether a reveal needs a reason.
- **Sessions:** a signed httpOnly, Secure, SameSite=Strict session cookie issued by the handlers layer; rate-limited login; an origin check on every state-changing request. State the session lifetime, and say how logout works if the cookie is stateless.
- **Login throttling counts by client IP, never by account.** Locking an account after failed logins would let a stranger lock my demo users out before a recruiter arrives. Behind nginx, read the client IP from the forwarded header that host nginx sets, and trust that header from nginx only.
- **Least privilege:** a separate database user per service, plus an admin user for migrations, grants and resets that no running service uses. The handlers get SELECT on the tables they read, plus INSERT only where a phase requires it (such as PII-reveal audits). All enforcement writes stay in Rails. Rails and MySQL are never exposed, and containers run read-only with capabilities dropped wherever possible.
- **Validation at boundaries:** zod on every handler input; strong params and model validations in Rails.
- **Sanitized errors:** clients get a generic message plus a correlation ID, never stack traces or SQL. Full detail goes to structured logs.
- **Logs carry ids, not PII.** Log account ids and staff user ids. Never log emails, IPs, fingerprints, passwords, cookies or signatures.
- **Signed service-to-service calls with replay protection:** the handlers sign `method + path + timestamp + nonce + sha256(body)` with an HMAC secret. Rails verifies the signature, rejects timestamps outside a 60-second window either way, and rejects any nonce it has already seen.
  - Join the five parts with a newline. Without a separator, two different requests can produce the same string.
  - The path includes the query string.
  - Rails compares signatures in constant time.
  - The acting staff user's id travels inside the signed body. Rails loads that user and checks the group itself. It never trusts a group sent by the handlers.
  - Nonces older than the time window are deleted.
  - One file of test vectors in `packages/shared/fixtures` holds known inputs and their expected signatures. The Jest tests and the Rails tests both read it.
- **Idempotency:** enforcement endpoints accept an `Idempotency-Key` header. The browser creates the key when the dialog opens. The same key with the same body returns the stored response. The same key with a different body returns 422. A unique index settles two requests that arrive together.
- **Secrets:** only in a gitignored `.env`, with a `.env.example` documenting every variable. Run gitleaks in CI. Never read, copy or overwrite my real `.env` files.
- **Correlation IDs** flow from the browser through the handlers to Rails, and appear in every log line. The handlers accept an incoming ID only if it is a valid UUID and otherwise create a new one, so nobody can write arbitrary text into the logs.
- **Browser security headers** set at nginx: a Content-Security-Policy, `X-Content-Type-Options`, `Referrer-Policy` and a ban on framing.
- **The demo is public and the credentials are published,** so plan for strangers. Section 8 covers the reset. Phase 5 covers the spending cap on the LLM.

## 6. Ruby and Rails, documented for learning

Rails is new to me, so the Rails app must double as my textbook. I'll study it before the interview and explain it during the interview.

**File headers.** Every file under `app/`, `db/migrate/`, `lib/` and `test/`, plus `config/routes.rb`, `db/seeds.rb` and any initializer we wrote, starts with a short header comment: what the file is, which Rails convention put it there, and the closest equivalent in Express, NestJS or Django. Generated files we didn't change get a row in the file map instead of a header.

**Create `docs/rails-learning-guide.md` covering:**

- a Ruby primer for a TypeScript developer, built from snippets in this repository: symbols, blocks, implicit return, method names ending in `?` and `!`, modules as mixins, keyword arguments, `attr_reader`, symbol keys vs string keys, safe navigation with `&.`, and the fact that only `nil` and `false` are falsy, so `0` and `""` are truthy;
- Bundler, the Gemfile and `Gemfile.lock` next to pnpm, `package.json` and the lockfile;
- the request lifecycle in this app, step by step, with file paths: Rack middleware, route, controller, before_action filters, model, serializer, response;
- each Rails concept the app uses, with where it appears in this repo and its Express, NestJS or Django equivalent: routes, controllers, strong params, ActiveRecord models, validations, callbacks, associations, scopes, enums, transactions and locking, migrations, seeds, serializers, concerns, service objects, `rescue_from`, `ActiveSupport::CurrentAttributes`, initializers, Zeitwerk autoloading, tagged logging, time zones and `Time.current`, N+1 queries and `includes`, credentials and environment config, Puma, and the test framework with its fixtures;
- the "magic" list: conventions Rails applies implicitly (naming, autoloading, pluralization, implicit rendering, reserved column names) that would confuse someone coming from Node;
- a file map of `apps/core-api`: every file marked as generated and untouched, generated and edited, or written by us, plus the exact `rails new` command and what it skipped;
- where this app departs from a stock Rails app, so I don't mistake our choices for Rails conventions: API-only mode, no views, no Rails sessions, HMAC verification, `structure.sql`, environment variables in place of credentials, no background jobs;
- debugging: reading a Rails stack trace, the development log and its SQL lines, breakpoints with the `debug` gem, `rails console --sandbox` and `rails dbconsole`;
- a 30-minute reading path through the codebase;
- the daily commands, each written as the full Docker command I would type on my machine: `rails routes`, `rails console`, `rails db:migrate`, and running the tests.

**Teach at the gate.** Every design note for a Rails step lists the Rails concepts that step introduces, with two or three lines each. Where practical, one commit introduces one concept, and the guide's concept table links to that commit.

**Create `docs/rails-exercises.md`.** Six to eight exercises that I do myself after the build, easiest first. You write the exercises and don't solve them for me. Each one names the goal, the concept, the files involved and a test that tells me I got it right. Put the solutions on a separate branch. Examples: explore the models in the console, add a validation with its failing test first, add a column through a migration and expose it in the serializer, add a `warn` enforcement action end to end.

**Create `docs/rails-interview-notes.md`.** The questions an interviewer is likely to ask about this code, each with a short answer and a file path. Include the uncomfortable ones: why HMAC and not mutual TLS, why two services share a database, what breaks first at 100 times the data, and what I would do differently.

**Style.** Prefer explicit, readable Rails over clever metaprogramming. Wherever a Ruby or Rails idiom hides behavior, add a one-line comment saying what it does.

If the clock forces a choice, the guide may trail the code by one phase. It must be complete before Phase 2 is called done.

## 7. Build phases

Every phase follows the same loop: design gate, tests, implementation, run everything, update docs, my review. Don't start the next phase until I approve.

The deploy comes early on purpose. It goes onto a shared server and depends on DNS, a certificate and memory I haven't measured, so it is the step most likely to eat the deadline. It happens while the app is small and there is still time to fix what breaks.

**Phase 0: scaffold and preflight (keep it short).**

- Move this brief to `docs/build-brief.md`, where CLAUDE.md expects it. CLAUDE.md already exists. Reconcile it with this brief, add the approved dependencies to its Stack section, and fill in Commands as you verify each one. Where the two files disagree, this brief wins and you list the difference in the design note.
- Repository layout, `.gitattributes`, `.gitignore`, `.env.example`, Docker Compose for local development with health checks, the docs skeleton, and CI: typecheck, lint, Jest, Rails tests against a MySQL service, RuboCop, Brakeman, bundler-audit, `pnpm audit` and gitleaks.
- Generate the Rails app in a throwaway Ruby container, in API mode for MySQL, without a git repository of its own, skipping the parts this app doesn't use. Pin the Ruby and Rails versions. Propose how to handle the generated `config/master.key` and `config/credentials.yml.enc`, and don't delete either without my approval.
- Server preflight: give me a short list of read-only commands to run on the instance, covering memory, swap, disk, CPU count, running containers, listening ports, and the nginx and certbot versions. From my output, write the memory budget and tell me plainly whether the instance can hold this app next to fusion.
- I add the DNS record during this phase, since it takes time to spread.
- Run the council decisions and write the ADRs.

**Phase 1: walking skeleton, live.** One thin path through every tier, deployed.

- Migrations for every table in section 4, the trigger, the database users with their grants, and the full seed.
- Handlers: login, account search by status only, account detail.
- Rails: suspend with a required reason, through the signed call, writing the enforcement action and the audit row.
- UI: a login page that lists the demo accounts with a one-click sign-in for each group, a plain search list, an account page with the suspend dialog (Radix), and the audit trail view.
- Tests: signing tests on both sides using the shared vectors; Rails request tests for suspend covering success, a bad signature, a replayed request, a stale timestamp, a missing reason and the wrong group; a test proving that UPDATE and DELETE on the audit table fail; one handler test against real MySQL; and one Playwright smoke test that signs in, suspends an account and sees the audit row.
- Deploy following section 8. The smoke test passes against the live URL and fusion still answers. Then stop and tell me it's live.

**Phase 2: complete the core and redeploy.** This is the minimum I want to present. Build in the order below, which puts first what a recruiter notices first. If time runs out, stop after any step. The app must work and be deployed at every stop.

1. Risk score with its contributing signals on the account page.
2. Search by fingerprint and IP, which shows the abuse clusters, then by email fragment, all with keyset pagination.
3. PII masking per group, reveal per account, and the reveal audit.
4. Unsuspend and mark as spam, with idempotency keys.
5. Event timeline.
6. Operational mode changes and the mode indicator.
7. Logout, login throttling, and whatever remains of section 5.

Across those steps:

- UI: every view handles loading, empty, error and forbidden states. Every control works from the keyboard with visible focus, and every input has a label.
- Tests: Jest unit tests (risk rules, masking, signing); handler tests with mocked database and auth, plus tests against real MySQL for every query that uses JSON paths, generated columns, keyset pagination or the fallback aggregation; React component tests with Testing Library, with a jest-axe check on the search page, the account page and the enforcement dialog; and Rails request tests for every action covering a bad signature, a replayed request, a missing reason, the wrong group, an invalid state change and a repeated idempotency key. Use Jest, not Vitest, since the team uses Jest.
- Docs: the README, the learning guide, the demo script and the interview notes cover everything built so far.

Then the extras, in this order, each only once the previous one is done, tested and deployed:

**Phase 3: risk trend chart.** A 30-day time series of the risk score and key signals per account (Recharts or similar), with accessible fallback text.

**Phase 4: bulk actions and CSV export.** Multi-select in the search results; a Rails bulk endpoint with a maximum batch size, per-account results and idempotency; and a streamed CSV export that respects group masking and escapes spreadsheet formula injection (cells starting with `=`, `+`, `-` or `@`).

**Phase 5: LLM case summary with an approval gate.** Use the Anthropic API, with the model id in environment config and the prompt versioned in the repository. Redact emails, IPs and fingerprints into tokens before anything leaves the server. Store the summary as SUGGESTED; an analyst approves, edits or rejects it, and only an approved summary attaches to the case. A summary can never trigger enforcement. Handle timeouts and API outages gracefully, log token counts but never raw PII, and test with a mocked client.

- The data model has no case yet. Define it in the design note: what a case is, its table, and which service writes it.
- The demo is public, so cap the spend: a daily request limit, a token limit per request, and an environment flag that switches the feature off.

**Phase 6: log-platform fallback on Loki.** Ship events as structured logs to Grafana Loki and replace the simulated fallback with LogQL queries through Loki's query API. Keep labels low-cardinality: no `account_id` label; filter with `| json | account_id="..."` instead. Give Loki a strict memory limit.

If time runs out, stop cleanly. Anything unfinished goes in the README under "Not built, on purpose," with a note on how it would plug in. Also list the abuse control registry and its coverage and effectiveness models there, with a short sketch of how they would fit.

## 8. Deployment (my existing AWS instance)

- This is the same EC2 instance that already serves `https://fusion.filhmar.online`. **Do not break it.**
- The new subdomain is `trust.filhmar.online`. I'll add the DNS A record. Add a separate nginx server block and issue one certificate for this hostname with certbot.
- In Compose, publish only what host nginx needs, bound to `127.0.0.1`. Services that serve HTTP must listen on `0.0.0.0` inside their containers. Rails and MySQL are never published. Set a memory limit on every service.
- Before deploying, tell me the total memory budget and whether my instance size is enough. The Phase 0 preflight gives you the numbers.
- **You have no SSH access to the instance.** Write `docs/deploy-runbook.md` with numbered commands and the output I should expect from each. I run them and paste back what I get. If I give you access later, the same runbook applies, and you still show me each command before you run it.
- **Build images away from the instance,** in CI or on my machine, and pull them on the instance. Installing gems and building the web app there could exhaust its memory and take fusion down with it.
- **Stay out of fusion's way.** Use a Compose project name, network names and volume names that belong to this app only. Check that the ports you publish are free. Never edit fusion's nginx server block. Never run `docker system prune` or any command that touches containers, images, volumes or networks outside this project.
- **nginx:** back up the config before changing it, run `nginx -t` before every reload, and reload, never restart. Issue the certificate with `certbot certonly` and write the server block by hand, so certbot edits nothing.
- **Tune MySQL for a small server:** a small InnoDB buffer pool and the performance schema off. Put the numbers in the memory budget.
- **Rotate container logs** with a size limit, so a busy day can't fill the disk.
- **After every deploy,** run the smoke test against the live URL and check that fusion still answers.
- **Rollback:** write the rollback steps in the runbook before the first deploy. Keep the previous image tags on the instance.
- **Secrets on the instance** are generated there and live in its `.env`. They never pass through chat, the repository or CI logs.
- **Demo reset:** one command restores the seeded state, and a daily schedule on the host runs it. The audit table rejects DELETE, so the reset runs as the admin database user and empties that table by truncating it. Say so in the README, since an append-only log with a reset needs explaining.
- Ask search engines not to index the demo.

## 9. Known traps

I'd rather you read these now than find them at 3 AM. Check each one when you reach it. If one turns out not to apply to the versions you pinned, say so in the design note and move on.

**Windows and Docker**

- Git on Windows can check files out with CRLF line endings. A Linux container then fails to run `bin/rails` and similar scripts. Force LF in `.gitattributes`.
- `rails new` starts its own git repository unless told not to, which would nest a repository inside this one. Skipping git also skips the generated `.gitignore`, so write the Rails ignore rules by hand.

**Rails**

- A column named `type` switches on single-table inheritance. Section 4 already renames it.
- `db/schema.rb` records no triggers. A test database built from it has no append-only trigger, and the trigger test fails. Use `structure.sql`, which needs the MySQL client tools in the image.
- In development, Rails blocks requests whose Host header it doesn't know. Calls to `core-api:3000` fail until that host is allowed.
- Rails won't boot in production without `SECRET_KEY_BASE`.
- The generated production config has SSL settings meant for a public app. Check that plain HTTP calls from the handlers and the health check aren't redirected.
- Rails runs tests in parallel past a certain test count, and creates one database per worker. A database user with narrow grants can't create them.

**MySQL**

- MySQL 8 turns on binary logging by default. Creating a trigger then fails for a user without elevated privileges. Either set `log_bin_trust_function_creators` or turn binary logging off, which also saves memory.
- A grant on a table that doesn't exist yet fails. Apply grants after the migrations, as a separate step run by the admin user.
- TRUNCATE doesn't fire a DELETE trigger and needs the DROP privilege. The demo reset depends on both facts.
- The Node `mysql2` driver reads DATETIME values in the local time zone of the process unless told otherwise. Set it to UTC, or tests on my machine will be off by eight hours.

**Tests**

- Jest can't read `import.meta.env`. Keep every read of Vite's environment in one module that tests can mock.
- The jsdom test environment lacks `fetch`, `Request`, `Response` and `TextEncoder`. Handler tests run in the node environment. Web tests mock at the API client.

**Browser and nginx**

- Radix sets inline style attributes. A Content-Security-Policy that bans inline styles breaks its dialogs and menus.
- A single-page app needs nginx to fall back to `index.html`, or a refresh on an account page returns 404.

## 10. Deliverables

- **README:** what this is, stating plainly that it's a self-initiated demo built for this application; a table mapping each job description line to the feature and file that shows it; architecture; decisions (linking the ADRs); running locally in one command; running the tests; security notes; demo accounts; the daily reset; "Not built, on purpose"; and an AI usage summary. State plainly that the data is synthetic and that I learned Rails during this build.
- **`docs/demo-script.md`:** a 2-minute walkthrough for a recruiter (the live URL, one investigation, one enforcement, the audit trail) and a 10-minute technical version. Both name real seeded accounts. The Playwright smoke test follows the 2-minute script, so a passing test means the demo works.
- **A recording of the 2-minute walkthrough,** linked from the README, in case the live site is down when someone looks.
- **Also in `docs/`:** `job-description.md` (mine), `build-brief.md`, `decisions/`, `deploy-runbook.md`, `ai-usage.md`, `prompt-log.md` (mine), `bug-log.md`, `rails-learning-guide.md`, `rails-exercises.md` and `rails-interview-notes.md`.

Start by replying with everything rule 1 in section 1 asks for.
