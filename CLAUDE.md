# CLAUDE.md: trust-desk

Trust & Safety investigation console: a self-initiated demo for my interview for **Software Developer, Trust & Safety Tooling (Full Stack)**. The full brief is in `docs/build-brief.md`. Read it at the start of every phase. Where this file and the brief disagree, the brief wins, and you tell me about the difference.

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
- Everything runs in Docker for now, Node tooling included. If something can't run in Docker, tell me before you work around it.
- The repository path contains a space (`D:\My Folder\trust-desk`). Quote paths in every script and command.
- Git here converts line endings. Keep LF forced in `.gitattributes`, or scripts such as `bin/rails` fail inside Linux containers.

## Working rules

On 2026-09-29 I changed how this build runs. I can't approve each phase before the deadline, so you work on your own toward the goal and I review on the pull requests.

1. **Design notes, no waiting.** At the start of every phase, write a short note (what, why, files touched, tests planned) in `docs/design-notes/` and in the pull request, then carry on. Keep it under one page.
2. **Stop only at a gate.** There are two. One is the same error five times. The other is a step that needs a command only I can run. At a gate, say exactly what you need, stop, and wait for me.
3. **Don't guess.** Verify it, or raise it.
4. **Tests are the gate.** Write or outline the tests before implementing where practical. A step is done only when its tests pass and you've shown me the command output. Never claim something works without running it.
5. **Every bug gets a regression test:** failing test first, then the fix, then an entry in `docs/bug-log.md`. Never walk past a bug; fix it or report it to me.
6. **Small, reviewable steps.** Commit per step. Lead every commit and PR description with the outcome, then flag risks.
7. **One branch and one pull request per phase.** I merge, nobody else. Branch each phase from the one before it, so work continues while a pull request waits for me. Put no AI attribution in commits, pull requests or file headers. The AI record lives in `docs/ai-usage.md`.
8. **Two readings, same work:** pick one and note it in the design note. **Two readings, different work:** raise it.
9. **Adding a dependency** not listed under Stack needs my yes, so it is a gate. Pin exact versions.
10. **Keep the AI record:** after each phase, append what you generated to `docs/ai-usage.md`, leaving a placeholder for what I changed or rejected. `docs/prompt-log.md` is mine; don't edit it.
11. Write docs in plain English with no em dashes.
12. **Follow my global CLAUDE.md.** Load the skill it names before you write each kind of code. Where it disagrees with this file, this file wins.
13. **Watch the clock.** Follow the time budget in the brief. If a checkpoint slips by more than an hour, write what you would cut in the pull request and cut it.
14. **Never invent a job description line.** Quote `docs/job-description.md` exactly. If the file is missing or empty, that is a gate.
15. **Keep this file current:** add verified commands and newly discovered gotchas as you go. Never remove or change a locked decision without my approval.

## Phases

| Phase | What it delivers |
|---|---|
| 0 | Scaffold, CI, ADRs |
| 1 | Walking skeleton through every tier, running in Docker |
| 2 | Complete core. The minimum I want to present |
| Deploy gate | The goal ends here. I run the runbook, starting with the server preflight |
| 3 | Risk trend chart |
| 4 | Bulk actions and CSV export |
| 5 | LLM case summary with an approval gate |
| 6 | Log-platform fallback on Loki |

The goal is Phases 0 to 2, working end to end in Docker with every test passing. The deploy comes after the core. I decided that on 2026-09-29. Phase 2 has a fixed build order in the brief, and the app must work and pass its tests after every step.

## Decisions

- For real trade-offs, run the installed skill: "run the council on: <decision, options, constraints>" using `/llm-council`.
- Record every decision as an ADR in `docs/decisions/NNN-title.md`: context, options, the council's verdict (agreement and disagreement), my final decision, consequences.
- At most 5 council runs for the whole project, each with 4 subagents: three advisors and a chair.
- The council advises. While I'm away, follow its verdict and mark the ADR as provisional. I confirm or overturn it on the pull request.
- Rails tests use Minitest. The job description names no Rails test framework. Write that ADR without a council run.
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
- **No `.env` file from the agent.** Development values go straight into the Compose file for the development environment. I create the real env file myself before production.
- **Generated Rails credentials files:** keep `config/master.key` and `config/credentials.yml.enc`, both unused. Delete neither. `master.key` stays out of git.

## Proposals, built and waiting for my yes

Each one is built as written. I confirm or change it when I review the Phase 2 pull request. Until then it is not locked.

- **Operational mode effects:** `elevated` lowers the review threshold from 60 to 40 and shows a banner. `lockdown` does the same and refuses unsuspend with `blocked_by_lockdown`. Rails enforces the refusal.
- **Search by PII fields:** only `analyst` and `enforcer` may search by email, IP or fingerprint. A `viewer` who tries gets 403, not an empty list.
- **Reason on PII reveal:** required, 10 to 500 characters, the same rule as enforcement.
- **Who writes the PII-reveal audit row:** Rails, through a signed call, per ADR 005. The gap that remains is stated in that ADR.
- **ADR 001, raw SQL with `mysql2`:** decided by a council, provisional.
- **The list shows a quick risk score, the account page the full one.** See the Phase 2 design note.

## Stack

Versions were read from the registries on 2026-09-30. Exact pins live in the `package.json` files and in `Gemfile.lock`.

- **Web (`apps/web`):** React 18.3.1 (not 19), Vite 8.3.1, TypeScript 6.0.3 strict, TanStack Query 5.104.0, React Router 6.30.6, Tailwind CSS 4.3.3, Radix UI primitives, Recharts (Phase 3). Desktop only, 1280 px and wider.
- **Handlers (`apps/handlers`):** Node 22.23.3, TypeScript 6.0.3 strict, zod 4.6.5, `mysql2` 3.24.4, `bcryptjs` 3.0.3, `pino` 10.3.1. No Kysely, per ADR 001. Node runs the TypeScript source directly, so there is no build step.
- **Core API (`apps/core-api`):** Ruby 4.0.7, Rails 8.1.4, API-only, `mysql2` adapter, `puma`, `bcrypt`, `debug`.
- **Database:** MySQL 8.4.11.
- **Shared (`packages/shared`):** zod schemas; TypeScript types derived from them; shared fixtures.
- **Tests:** Jest 30.5.2, Testing Library and jest-axe for all TypeScript (not Vitest; the team uses Jest); Playwright 1.63.0 for the end-to-end smoke test; Minitest for Rails, per ADR 003.
- **Tooling:** pnpm 12.8.1 workspaces, Docker Compose, GitHub Actions, gitleaks, RuboCop with the Rails defaults (`rubocop-rails-omakase`), Brakeman, bundler-audit, `pnpm audit`.
- **Implied by the above, and listed in the Phase 0 design note for my review:** `typescript`, `eslint`, `typescript-eslint`, `eslint-plugin-jsdoc`, `@swc/core`, `@swc/jest`, `jest-environment-jsdom`, the Testing Library packages, the `@types/*` packages, `@vitejs/plugin-react`, `@tailwindcss/vite`.

## Security and PII

- Validate every input at the boundary: zod in the handlers; strong params and model validations in Rails.
- Clients get a generic error plus a correlation ID, never stack traces or SQL. Full detail goes to structured logs.
- Logs carry account ids and staff user ids. Never log emails, IPs, fingerprints, passwords, cookies or signatures.
- Correlation IDs flow from the browser through the handlers to Rails, and appear in every log line. The handlers accept an incoming ID only if it is a valid UUID, and otherwise create a new one.
- Mask PII for `viewer`; `analyst` reveals per account, and every reveal is audited.
- Masking happens on the server, in one module with unit tests. Event `payload` JSON, the timeline and the CSV export all pass through it.
- The browser keeps revealed values in memory only, never in local storage.
- Behind nginx, read the client IP from the forwarded header that host nginx sets, and trust that header from nginx only.
- Development values in the Compose file are made up and protect nothing, and the file says so. Keep `.env.example` complete, since I build the real env file from it. Never read, copy or overwrite my real `.env` files.
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

## Known gotchas (confirmed on this project)

Each one was hit for real on 2026-09-30. The error text is what the tool printed.

- **ERB runs inside YAML comments.** A comment in `config/database.yml` that showed the ERB tags literally stopped Rails from booting: `SyntaxError: --> /app/config/database.yml`. Describe the tags in words. See bug 001.
- **A grant on a missing table fails.** `Table 'trust_desk_development.schema_migrations' doesn't exist`. Rails creates that table only when the first migration runs. `db:grants` always runs after `db:prepare`.
- **A user with no grants cannot select the database at all,** so its health check fails. Every runtime user needs at least one table grant.
- **Debian's MySQL client is MariaDB's.** It refused the MySQL image's certificate: `mysqldump: Got error: 2026: "TLS/SSL error: self-signed certificate in certificate chain"`. The Rails image carries a client config that turns verification off. Rails calls this client to write and to load `db/structure.sql`.
- **MySQL ignores a config file anyone can write to,** and a file mounted from Windows arrives that way. The MySQL settings are copied into an image, not mounted.
- **pnpm 12 blocks a package published less than a day ago.** Pinning "latest" pulled in three such packages, and pnpm wrote exemptions for them into `pnpm-workspace.yaml` by itself. Never commit a `minimumReleaseAgeExclude` entry. Pin an older version.
- **pnpm 12 fails the install when a dependency has an install script that was neither allowed nor denied:** `ERR_PNPM_IGNORED_BUILDS`. The decision for each one is in `allowBuilds` in `pnpm-workspace.yaml`. All three are denied, and the tests pass without them.
- **`typescript-eslint` 8.71.0 accepts TypeScript below 6.1.0 only.** TypeScript stays on 6.0.3 until that range moves.
- **`jest-axe` ships no type declarations.** `apps/web/src/types/jest-axe.d.ts` declares the part the tests use.
- **Node 22 runs TypeScript source directly.** The handlers have no build step. That works only with syntax Node can erase, so `erasableSyntaxOnly` is on: no enums, no parameter properties, no namespaces.
- **My Claude Code settings deny writes to any path starting with `.env`,** `.env.example` included. The variable list lives in `docs/env-reference.md`.
- **On PowerShell, a native command that writes to stderr looks like a failure** even when it exits 0. Docker writes its progress to stderr. Read the exit code, not the red text.
- **Rails finds a new folder under `app/` only after a restart.** Autoload paths are fixed at boot. After `app/services/` was added, suspend answered 500 with `NameError message=uninitialized constant Internal::AccountsController::SuspendAccount` until `core-api` was restarted.
- **`bin/rails db:prepare` does not seed an existing database.** It seeds only when it has just created one, and here the MySQL container creates it first. `db:seed_if_empty` fills the gap.
- **In development Rails logs to `log/development.log`, not to the container's output.** `dc logs core-api` shows almost nothing. The SQL lines and their `↳` source markers are in the file.
- **No Rack middleware parses the JSON body.** `bin/rails middleware` lists 19 entries and none does it. The request object parses the body when `params` is first read.
- **SWC does not hoist `jest.mock` when `jest` is imported from `@jest/globals`.** The `require` of the subject ends up above the `jest.mock` call, so the mock never applies. The web app injects its API client through `ApiClientProvider` for that reason.
- **jsdom has no `Request`, and React Router's data router needs one to navigate.** Page tests render the route table through `MemoryRouter` and `useRoutes`.
- **Minitest 6 ships no `stub`.** A test that needs a method to fail uses a small subclass that overrides it.
- **A Ruby reader named `method` replaces `Object#method`.** `RequestSignature` names its reader `http_method`.
- **`mysql2` hands `SUM()` back as text and `COUNT()` as a number.** Row schemas use `z.coerce.number()` for both.
- **`crypto.randomUUID` does not exist on a plain HTTP origin.** Browsers expose it only on HTTPS and on localhost. The console showed `crypto.randomUUID is not a function` at `http://web:5173`. Use `createUuid` from `apps/web/src/lib/ids/createUuid.ts`. See bug 002.
- **An in-memory mount belongs to root.** With a read-only filesystem and a non-root user, Rails failed with `Permission denied @ dir_s_mkdir - /app/tmp/cache`. The `tmpfs` entries in `docker-compose.prod.yml` carry `uid=1001,gid=1001`. See bug 003.
- **nginx 1.24 refuses `http2 on;`:** `unknown directive "http2"`, and `nginx -t` fails the whole file. The directive appeared in 1.25.1, and Ubuntu 24.04 ships 1.24. The host config uses `listen 443 ssl http2;`, which both accept. Newer nginx prints a deprecation warning for it, which is expected.
- **Run the production images locally before every deploy.** Both bugs above appear only in the hardened image. `infra/scripts/check_production_images.sh` runs 18 checks against them.
- **Never build the same image tag from two commands at once.** Docker answered `image "trust-desk-prod-test-handlers:latest": already exists` and the Compose build failed.
- **Playwright matches a button name as a substring unless told `exact: true`.** "Suspend account" matched "Unsuspend account".
- **A `<select>` inside a section puts every option's text in that section.** Assert on the list of results, not on the section.
- **With `prepared_statements: true`, Ruby 4.0.7 with mysql2 0.5.7 crashed:** `[BUG] Segmentation fault`. They stay off. The cost is that the mysql2 adapter writes values into the SQL text, so at debug level the log holds them.
- **That crash left the test database half built.** The next run failed with `ActiveRecord::NoEnvironmentInSchemaError`. `bin/rails db:environment:set RAILS_ENV=test` fixed it.
- **MySQL reorders the keys of a JSON column.** A stored answer comes back equal as JSON and different as text. Compare parsed bodies.
- **During a test Rails hands every caller the same database connection.** A lock taken through the pool does not block the code under test. The advisory lock test opens its own connection.
- **`Rails.logger.tagged("x") { ... }` runs its block once per logger in a broadcast.** No code here uses the block form.
- **The symbol `:ip` in `filter_parameters` also filters `description`,** since it matches any key containing `ip`. The filter is the pattern `/(\A|_)ip\z/`.
- **The production handlers image took 11 minutes 28 seconds to install 28 packages,** against 18 seconds in development. The cause is not known yet. Allow for it when building images before a deploy.
- **A MariaDB dump starts with a sandbox comment that the MariaDB client understands.** `db/structure.sql` is written and loaded by the same client, so it works. Loading it with Oracle's `mysql` client has not been tried.

## Traps not yet verified

The brief lists more traps in section 9, covering Windows, Rails, MySQL, tests and nginx. Nobody has confirmed them on this project yet. Check each one when you reach it. When one is confirmed, move it into Known gotchas above with what you saw. When one turns out not to apply, say so in the design note.

## Commands

Verified commands only. Each one below was run on 2026-09-30 and worked. Run them from the repository root. `dc` stands for `docker compose -f docker-compose.dev.yml`, written out in full when you type it.

| Job | Command |
|---|---|
| Run everything | `dc up --build` |
| Stop everything | `dc down` |
| Install Node packages | runs by itself on `up`, as the `install` service |
| Add or change a Node package | `dc run --rm install pnpm install --no-frozen-lockfile --store-dir /repo/.pnpm-store` |
| Typecheck | `dc run --rm install pnpm run typecheck` |
| Lint | `dc run --rm install pnpm run lint` |
| TypeScript tests | `dc run --rm install pnpm run test` |
| Rails tests | `dc run --rm -e RAILS_ENV=test migrate sh -c "bin/rails db:test:prepare && bin/rails test"` |
| End-to-end smoke test | `dc --profile e2e run --rm e2e` |
| TypeScript tests against real MySQL | `dc run --rm handlers sh -c "cd /repo && pnpm --filter @trust-desk/handlers run test:integration"` |
| Migrate and apply grants | `dc run --rm migrate bin/rails db:prepare db:grants` |
| Migration status | `dc run --rm migrate bin/rails db:migrate:status` |
| Rails routes | `dc exec core-api bin/rails routes` |
| Rails console | `dc exec core-api bin/rails console` |
| RuboCop | `dc run --rm migrate bin/rubocop` |
| Brakeman | `dc run --rm migrate bin/brakeman --no-pager` |
| MySQL shell as the handlers user | `dc exec mysql mysql -utd_handlers -p trust_desk_development` |
| Rails development log, with SQL | `dc exec core-api tail -f log/development.log` |
| Rails middleware list | `dc run --rm migrate bin/rails middleware` |
| Seed data, and reset demo data | `dc run --rm migrate bin/rails db:seed` |
| Seed only when empty | runs by itself on `up`, as part of the `migrate` service |
| Rewrite the signing test vectors | `dc run --rm install node packages/shared/scripts/generate_signing_vectors.mjs` |
| Reset before and after the end-to-end tests | `dc run --rm migrate bin/rails db:seed` |
| Rehearse the edge: production images behind the real host nginx, with TLS | the four commands in `docs/deploy-runbook.md`, step 3a |
| Check the production images | start them as the header of `infra/scripts/check_production_images.sh` says, then `sh infra/scripts/check_production_images.sh` |
| Deploy | not run yet. Steps in `docs/deploy-runbook.md` |

Anything that migrates or tests runs in the `migrate` service, because it connects as the admin user. The `core-api` service connects as the runtime user, which cannot create a table.

The app is at `http://localhost:5173` once `up` has finished.

## Docs map

- `docs/build-brief.md`: the full build brief and phase plan
- `docs/design-notes/`: one short note per phase, written before the work starts
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
