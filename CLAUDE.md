# CLAUDE.md: trust-desk

Trust & Safety investigation console: a self-initiated demo for my interview for **Software Developer, Trust & Safety Tooling (Full Stack)**. The full brief is in `PROMPT.md` until Phase 0 moves it to `docs/build-brief.md`. Read it at the start of every phase. Where this file and the brief disagree, the brief wins, and you tell me about the difference.

**Deadline:** live at `https://trust.filhmar.online` by 2026-09-30, 17:00 UTC+8.

**Priorities, in this order.** When two conflict, the lower one gives way.

1. A working core, live at the URL, by the deadline.
2. Rails code and docs that I can study and explain.
3. The extras in Phases 3 to 6.

## About me

- I'm John. I'm strong in TypeScript, React and Node.js, with working knowledge of Python, Go and Java.
- **Ruby on Rails is new to me, and so is Ruby itself.** Explain every concept, convention and implicit behavior specific to Ruby or Rails. Don't explain programming fundamentals (OOP, HTTP, REST, SQL, MVC, testing, auth); I know those.
- I must be able to explain every line in this repository in an interview. If something is clever, make it plain instead.

## My machine

- Windows 11 with Docker Desktop, Node 22, PowerShell and Git Bash.
- Ruby is not installed, and it stays that way. Every Ruby and Rails command runs in a container, including `rails new`.
- The repository path contains a space (`D:\My Folder\trust-desk`). Quote paths in every script and command.
- Git here converts line endings. Keep LF forced in `.gitattributes`, or scripts such as `bin/rails` fail inside Linux containers.

## Working rules

1. **Design gate before every phase:** write a short note (what, why, files touched, tests planned) and wait for my approval. No code before approval. Keep the note under one page, and put every question for the phase in it, so I answer once.
2. **Tests are the gate.** Write or outline the tests before implementing where practical. A step is done only when its tests pass and you've shown me the command output. Never claim something works without running it.
3. **Every bug gets a regression test:** failing test first, then the fix, then an entry in `docs/bug-log.md`. Never walk past a bug; fix it or report it to me.
4. **Small, reviewable steps.** Commit per step. Lead every commit and PR description with the outcome, then flag risks.
5. **One branch and one pull request per phase.** I merge. Put no AI attribution in commits, pull requests or file headers. The AI record lives in `docs/ai-usage.md`.
6. **Ask only when different readings would lead to materially different work.** Otherwise choose the sensible option and note it in the design note.
7. **Ask before adding any dependency** not listed under Stack. Pin exact versions.
8. **Keep the AI record:** after each phase, append what you generated to `docs/ai-usage.md`, leaving a placeholder for what I changed or rejected. `docs/prompt-log.md` is mine; don't edit it.
9. Write docs in plain English with no em dashes.
10. **Watch the clock.** Follow the time budget in the brief. If a checkpoint slips by more than an hour, stop and tell me what you would cut.
11. **Never invent a job description line.** Quote `docs/job-description.md` exactly. If the file is missing or empty, stop and ask me for it.
12. **Keep this file current:** add verified commands and newly discovered gotchas as you go. Never remove or change a locked decision without my approval.

## Phases

| Phase | What it delivers |
|---|---|
| 0 | Scaffold, CI, server preflight, ADRs |
| 1 | Walking skeleton through every tier, deployed live |
| 2 | Complete core, redeployed. The minimum I want to present |
| 3 | Risk trend chart |
| 4 | Bulk actions and CSV export |
| 5 | LLM case summary with an approval gate |
| 6 | Log-platform fallback on Loki |

The deploy comes in Phase 1 on purpose. Phase 2 has a fixed build order in the brief, and the app must work and be deployed after every step.

## Decisions

- For real trade-offs, run the installed skill: "run the council on: <decision, options, constraints>" using `/llm-council`.
- Record every decision as an ADR in `docs/decisions/NNN-title.md`: context, options, the council's verdict (agreement and disagreement), my final decision, consequences.
- At most 5 council runs for the whole project. The council advises; I decide at the design gate.
- Run the councils during Phase 0 while the scaffold builds. Every ADR names a default, so a slow or failed run never blocks a phase. The brief lists the candidates and my defaults.
- Bulk action semantics are already decided: per-account results. Don't council that.

## Locked decisions (do not change without asking)

- **Split:** TypeScript handlers own reads; Rails owns enforcement writes. The browser talks only to the handlers.
- **Handlers:** plain `(req: Request, deps: Deps) => Promise<Response>` functions, one per file, with database, auth and clock injected. Portable to AWS Lambda; a thin Node adapter serves them on EC2. Anything held in process memory gets a comment naming the limit and the replacement.
- **Rails:** API-only, never exposed publicly, reachable only on the internal Docker network through HMAC-signed calls from the handlers.
- **Signing:** HMAC over `method + path + timestamp + nonce + sha256(body)`, joined with newlines. The path includes the query string. Rails compares in constant time and rejects bad signatures, timestamps outside a 60-second window either way, and reused nonces.
- **Actor:** the acting staff user's id travels inside the signed body. Rails loads that user and checks the group itself. It never trusts a group sent by the handlers.
- **Contract:** zod schemas in `packages/shared` cover the browser to handlers calls and every Rails response the handlers parse. Fixtures in `packages/shared/fixtures`, including the signing test vectors, feed both the Jest tests and the Rails tests.
- **Database:** MySQL 8. Rails migrations own the schema. A separate least-privilege database user per service, plus an admin user for migrations, grants and resets that no running service uses.
- **Naming:** table names follow Rails pluralization (`staff_users`, `audit_logs`, `operational_modes`). The event kind column is `event_type`, never `type`. The staff group column is `group_name`, never `group`.
- **Audit log** is append-only, enforced by a MySQL trigger that rejects UPDATE and DELETE. No runtime database user holds UPDATE or DELETE on the table.
- **Enforcement writes:** the status change, the enforcement action and the audit row go in one transaction. An action that doesn't fit the current state returns 409 with a specific error code. Two enforcers acting on one account at once must not both succeed.
- **Idempotency:** the same key with the same body returns the stored response. The same key with a different body returns 422. A unique index settles a race.
- **Risk score** is rule-based and explainable, and always returns its contributing signals. No machine learning. One implementation only, a pure TypeScript function. `account_daily_stats` stores counts, never a score, and Ruby never computes one.
- **Auth:** signed httpOnly, Secure, SameSite=Strict session cookie issued by the handlers; groups `viewer`, `analyst`, `enforcer`, enforced server-side everywhere.
- **Login throttling** counts by client IP, never by account.
- **Pagination:** keyset, not offset.
- **JSON field names** are snake_case from both services. The web app reads them as they arrive, with no renaming layer.
- **Time** is UTC in the database, in Rails and in the handlers. A day in `account_daily_stats` is a UTC day.
- **Errors:** one envelope, defined once in `packages/shared`: `{ "error": { "code", "message", "correlation_id" } }`.
- **Synthetic data only:** emails on `example.com` or `example.org`; IPs only from RFC 5737 ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24). The seed is deterministic, and its dates are relative to the day it runs.
- **LLM output** (Phase 5) is only ever a suggestion behind a human approval gate, and never triggers enforcement. PII is redacted before any call leaves the server. The feature has a spending cap and an off switch.

## Proposals, not locked yet

I confirm or change these at the gate named.

- **Operational mode effects** (Phase 2 gate): `elevated` lowers the score at which search flags an account; `lockdown` refuses unsuspend. Each mode must change one behavior a test can observe.
- **Search by PII fields** (Phase 2 gate): only `analyst` and `enforcer` may search by email, IP or fingerprint. `viewer` searches by status and risk band.
- **Reason on PII reveal** (Phase 2 gate): whether a reveal needs one.
- **Who writes the PII-reveal audit row** (council): the handlers with a narrow INSERT grant, or Rails through a signed call.
- **Generated Rails credentials files** (Phase 0 gate): propose how to handle `config/master.key` and `config/credentials.yml.enc`. Don't delete either without my approval.

## Stack

- **Web (`apps/web`):** React 18 (not 19), Vite, TypeScript strict, TanStack Query, React Router 6, Tailwind CSS, Radix UI primitives, Recharts (Phase 3). Desktop only, 1280 px and wider.
- **Handlers (`apps/handlers`):** Node 22, TypeScript strict, zod, `mysql2`, `bcryptjs`, `pino`. Kysely only if its ADR picks it.
- **Core API (`apps/core-api`):** current stable Ruby and Rails (pin the versions), API-only, `mysql2` adapter, `puma`, `bcrypt`, `debug`.
- **Shared (`packages/shared`):** zod schemas; TypeScript types derived from them; shared fixtures.
- **Tests:** Jest, Testing Library and jest-axe for all TypeScript (not Vitest; the team uses Jest); Playwright for the end-to-end smoke test; Rails tests per ADR.
- **Tooling:** pnpm workspaces, Docker Compose, GitHub Actions, gitleaks, RuboCop with the Rails defaults, Brakeman, bundler-audit, `pnpm audit`.

## Security and PII

- Validate every input at the boundary: zod in the handlers; strong params and model validations in Rails.
- Clients get a generic error plus a correlation ID, never stack traces or SQL. Full detail goes to structured logs.
- Logs carry account ids and staff user ids. Never log emails, IPs, fingerprints, passwords, cookies or signatures.
- Correlation IDs flow from the browser through the handlers to Rails, and appear in every log line. The handlers accept an incoming ID only if it is a valid UUID, and otherwise create a new one.
- Mask PII for `viewer`; `analyst` reveals per account, and every reveal is audited.
- Masking happens on the server, in one module with unit tests. Event `payload` JSON, the timeline and the CSV export all pass through it.
- The browser keeps revealed values in memory only, never in local storage.
- Behind nginx, read the client IP from the forwarded header that host nginx sets, and trust that header from nginx only.
- Secrets live only in a gitignored `.env`; keep `.env.example` complete. Never read, copy or overwrite my real `.env` files.
- nginx sets a Content-Security-Policy, `X-Content-Type-Options`, `Referrer-Policy` and a ban on framing.
- CSV exports escape cells starting with `=`, `+`, `-` or `@`.
- The demo is public and its credentials are published. Plan for strangers.

## Rails documentation rules

- Every file under `app/`, `db/migrate/`, `lib/` and `test/`, plus `config/routes.rb`, `db/seeds.rb` and any initializer we wrote, starts with a header comment: what it is, which Rails convention put it there, and its closest Express, NestJS or Django equivalent. Generated files we didn't change get a row in the guide's file map instead.
- Keep `docs/rails-learning-guide.md` updated as you add Ruby and Rails concepts. The brief lists what it must cover.
- Every design note for a Rails step lists the Rails concepts that step introduces, with two or three lines each.
- Write `docs/rails-exercises.md` and `docs/rails-interview-notes.md`. You write the exercises and don't solve them for me. Solutions go on a separate branch.
- Prefer explicit Rails over metaprogramming. Wherever a Ruby or Rails idiom hides behavior, add a one-line comment saying what it does.
- The guide may trail the code by one phase. It must be complete before Phase 2 is called done.

## Deployment constraints

- The EC2 instance also serves `https://fusion.filhmar.online`. **Never break it.**
- This app is served at `https://trust.filhmar.online` through its own nginx server block and its own certificate.
- Publish only what host nginx needs, bound to `127.0.0.1`. Rails and MySQL are never published. Set a memory limit on every service.
- **You have no SSH access to the instance.** Write `docs/deploy-runbook.md` with numbered commands and the output I should expect. I run them and paste back what I get.
- Build images away from the instance, in CI or on my machine, and pull them there.
- Use a Compose project name, network names and volume names that belong to this app only. Never edit fusion's nginx server block. Never run `docker system prune` or any command that touches containers, images, volumes or networks outside this project.
- Back up the nginx config before changing it, run `nginx -t` before every reload, and reload, never restart. Issue the certificate with `certbot certonly` and write the server block by hand.
- Write the rollback steps in the runbook before the first deploy. Keep the previous image tags on the instance.
- After every deploy, run the smoke test against the live URL and check that fusion still answers.
- Secrets on the instance are generated there. They never pass through chat, the repository or CI logs.
- One command resets the demo to the seeded state, and a daily schedule runs it. The reset runs as the admin database user and truncates the audit table.

## Known gotchas (learned on my previous deployment)

- Services that serve HTTP must listen on `0.0.0.0` **inside** their container. Binding to `127.0.0.1` inside a container makes it unreachable through Docker port mapping and causes a 502.
- The Compose port mapping must target the port the app actually listens on. A mapping to the wrong container port also produces a 502.
- nginx `proxy_pass` must point at the app's published port, never at nginx's own port, or requests loop into a redirect cycle.
- Issue one certificate covering every name nginx serves for this app. Separate certificates per name caused a hostname mismatch warning last time.
- If WebSockets are ever added, nginx needs `proxy_http_version 1.1` plus the `Upgrade` and `Connection` headers, or live updates fail silently.

## Traps not yet verified

The brief lists more traps in section 9, covering Windows, Rails, MySQL, tests and nginx. Nobody has confirmed them on this project yet. Check each one when you reach it. When one is confirmed, move it into Known gotchas above with what you saw. When one turns out not to apply, say so in the design note.

## Commands

Verified commands only. Fill this in during Phase 0 after actually running each one. Write every Rails command as the full Docker command I would type on my machine.

- Install: TBD
- Run locally: TBD
- TypeScript tests: TBD
- Rails tests: TBD
- End-to-end smoke test: TBD
- Rails console: TBD
- Migrate: TBD
- Seed data: TBD
- Reset demo data: TBD
- Deploy: TBD

## Docs map

- `docs/build-brief.md`: the full build brief and phase plan (`PROMPT.md` until Phase 0 moves it)
- `docs/job-description.md`: the job description, pasted by me word for word (mine only)
- `docs/decisions/`: ADRs
- `docs/rails-learning-guide.md`: my Ruby and Rails textbook for this codebase
- `docs/rails-exercises.md`: exercises I solve myself after the build
- `docs/rails-interview-notes.md`: likely interview questions, with answers and file paths
- `docs/deploy-runbook.md`: numbered deploy and rollback commands
- `docs/ai-usage.md`: what the AI generated each phase, and what I changed
- `docs/prompt-log.md`: my prompts (mine only)
- `docs/bug-log.md`: every bug and its regression test
- `docs/demo-script.md`: the 2-minute and 10-minute walkthroughs
