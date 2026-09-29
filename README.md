# Trust Desk

A Trust and Safety investigation console: search accounts, read their risk, act on them, and see who did what.

**This is a demo I built on my own initiative** for my application to a Software Developer, Trust & Safety Tooling (Full Stack) role. It is not a product and it has no real users.

**All data is synthetic.** Emails use `example.com` and `example.org`. IP addresses come only from the ranges reserved for documentation.

**I learned Ruby and Rails during this build.** `docs/rails-learning-guide.md` is the record of that.

Status: Phase 0 of 6. The repository starts and tests pass. There are no features yet.

## Run it

You need Docker and nothing else. No Node, no Ruby, no env file.

```
docker compose -f docker-compose.dev.yml up --build
```

Then open `http://localhost:5173`.

## Run the tests

```
docker compose -f docker-compose.dev.yml run --rm install pnpm run test
docker compose -f docker-compose.dev.yml run --rm -e RAILS_ENV=test migrate sh -c "bin/rails db:test:prepare && bin/rails test"
docker compose -f docker-compose.dev.yml --profile e2e run --rm e2e
```

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
| Shared | `packages/shared` | The zod schemas both sides agree on |
| End to end | `e2e` | The Playwright smoke test |

Two services share one database. That is a trade-off, and the section on it is written in Phase 2.

## Decisions

| ADR | Decision | How it was decided |
|---|---|---|
| [001](docs/decisions/001-typescript-data-access.md) | Raw SQL with `mysql2` and zod, no query builder | Council |
| [002](docs/decisions/002-rails-serializers.md) | Plain Ruby serializers | Default from the brief |
| [003](docs/decisions/003-rails-test-framework.md) | Minitest | By me |
| [004](docs/decisions/004-nonce-store.md) | Nonces in a MySQL table | Default from the brief |
| [005](docs/decisions/005-pii-reveal-audit-writer.md) | Rails writes the audit row for a PII reveal | Council |

## Still to be written

Filled in as each phase lands: the table mapping each job description line to a feature and a file, security notes, demo accounts, the daily reset, "Not built, on purpose", and the AI usage summary.

## More

- `docs/build-brief.md`: the full brief
- `docs/rails-learning-guide.md`: Ruby and Rails, explained through this code
- `docs/env-reference.md`: every environment variable
- `docs/bug-log.md`: every bug and the test that now catches it
- `docs/ai-usage.md`: what the AI generated and what I changed
