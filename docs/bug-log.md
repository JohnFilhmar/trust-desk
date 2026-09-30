# Bug log

Every bug found during the build, with the test that now catches it. Newest first.

## 007: the login rate limit refused ordinary use

- **Found:** 2026-09-30, by the edge rehearsal, the first time the browser tests ran through the real host nginx config.
- **Symptom:** the last test to sign in got "Too many sign-in attempts". 12 tests had passed before it.
- **Cause:** nginx allowed 10 logins a minute per IP with a burst of 5. The suite signs in 10 times in 30 seconds, from one IP. A recruiter clicking through the three demo users a few times would meet the same wall.
- **Fix:** 30 a minute with a burst of 10. The guard against guessing passwords was never this limit: the handlers refuse an IP after 10 failed logins in 5 minutes. Checked through the edge: ten wrong passwords got 401, the eleventh got the handlers' 429.
- **Regression test:** the whole browser suite, run through `docker-compose.edge-test.yml`. It cannot pass while the limit refuses it.

## 006: the Content-Security-Policy reported a violation on every page load

- **Found:** 2026-09-30, by the edge rehearsal, with a test written that day for exactly this: `e2e/tests/console.spec.ts`.
- **Symptom:** `CSP violation: script-src blocked eval`. The console still worked.
- **Cause:** zod 4 compiles a fast parser for each object schema with `new Function`, and probes for that the first time an object schema is built. The CSP refuses it. zod catches the refusal and falls back, and the browser logs the violation anyway. zod's own source says so, in `v4/core/util.js`.
- **Fix:** `z.config({ jitless: true })` in `apps/web/src/lib/zod/configureZod.ts`, imported first in `main.tsx`. First matters: zod reads the setting while a schema is being built, and `@trust-desk/shared` builds its schemas when it is imported.
- **Regression test:** `e2e/tests/console.spec.ts` fails on any CSP violation or uncaught error. Run it against the live site after every deploy, since only the live site sends the real CSP.
- **Why nothing caught it before:** the development server sends no CSP. Only host nginx does.

## 005: the nginx config failed on the nginx most servers ship

- **Found:** 2026-09-30, before any deploy, by running `nginx -t` on the host config in nginx 1.24 and 1.29 containers.
- **Symptom:** `unknown directive "http2" in /etc/nginx/conf.d/default.conf:35`, and `nginx -t` failed the whole file.
- **Cause:** the config used `http2 on;`, a directive that appeared in nginx 1.25.1. Ubuntu 24.04 ships 1.24.
- **Who it would have hit:** the deploy itself. The runbook runs `nginx -t` before every reload, so the site would not have gone up, and fusion would have been safe.
- **Fix:** `listen 443 ssl http2;`, which 1.24 accepts and 1.29 accepts with a deprecation warning.
- **Regression test:** `docker-compose.edge-test.yml` runs the real config in nginx 1.24 and stops at `nginx -t` if it fails.

## 004: the return path after sign-in could send a visitor to another site

- **Found:** 2026-09-30, Phase 2, while reading `pnpm audit` output about an open redirect in react-router.
- **Symptom:** none seen. The check refused `//evil.example.org` and let `/\evil.example.org` through, which browsers read as `//evil.example.org`.
- **Cause:** a pattern of what to refuse. Such a list is only as good as the last trick its author thought of.
- **Fix:** `apps/web/src/lib/navigation/readReturnPath.ts` allows only this console's own pages: `/accounts`, `/accounts/<digits>` and `/audit`, with a restricted query string.
- **Regression test:** `apps/web/src/lib/navigation/readReturnPath.test.ts`, 26 cases. Against the old check, 10 of them failed.

## 003: the production Rails container never started

- **Found:** 2026-09-30, Phase 2, the first time the production images were run, on a development machine and before any deploy.
- **Symptom:** `core-api` restarted in a loop. The log said `Permission denied @ dir_s_mkdir - /app/tmp/cache (Errno::EACCES)`.
- **Cause:** the production container has a read-only filesystem, with in-memory mounts at `/app/tmp` and `/app/log` for what Rails must write. An in-memory mount belongs to root unless told otherwise, and Rails runs as user 1001. So Rails could not create `tmp/cache`.
- **Why development missed it:** the development container runs as root on a writable filesystem. The fault exists only where the hardening is.
- **Fix:** the two mounts in `docker-compose.prod.yml` now carry `uid=1001,gid=1001,mode=0700`.
- **Regression test:** `infra/scripts/check_production_images.sh` runs 18 checks against the production images through the ports they publish. It cannot pass unless Rails is up, since check 12 suspends an account through the signed call. It passed after the fix.
- **What it taught me:** every hardening option is a change in behavior, and only running the hardened image shows what it broke. Had the production images first run on the server, this would have cost part of the deploy window.

## 002: the console failed on any plain HTTP origin other than localhost

- **Found:** 2026-09-30, Phase 1, by the first Playwright run against a clean checkout. 4 of 5 tests failed. The one that passed used no page.
- **Symptom:** the login page showed "Your session could not be checked" and under it `crypto.randomUUID is not a function`. No request left the browser.
- **Cause:** the web app created every correlation id with `crypto.randomUUID()`. Browsers expose that function only in a secure context, which means HTTPS or `localhost`. The test container opens the app at `http://web:5173`, which is neither. The brief the AI wrote for the web subagent named that function, so the fault was in the instruction and not in how it was followed.
- **Why the unit tests missed it:** they run in Node, where `crypto.randomUUID` always exists. Only a real browser on a real origin could show it.
- **Who it would have hit:** anyone opening the development stack by machine name or by LAN address. Production is served over HTTPS and would have worked, which is exactly why this kind of bug survives until a bad day.
- **Fix:** `apps/web/src/lib/ids/createUuid.ts` uses `crypto.randomUUID` when it exists and otherwise builds a version 4 UUID from `crypto.getRandomValues`, which browsers expose on plain HTTP too. Every call site uses it.
- **Regression test:** `apps/web/src/lib/ids/createUuid.test.ts` removes `crypto.randomUUID` and checks that a valid UUID still comes back. A second test does the same one level up, for a whole request. The Playwright tests run on a plain HTTP origin on every run, so they catch it too.
- **What it taught me:** an API that exists in the test runner may not exist in the browser. The end-to-end test is the only tier that runs the real thing, and it should run on the least forgiving origin.

## 001: a comment in `database.yml` stopped Rails from booting

- **Found:** 2026-09-30, Phase 0, when the migrate container exited with code 1.
- **Symptom:** `bin/rails aborted! SyntaxError: --> /app/config/database.yml` followed by `unexpected ':', expecting end-of-input`.
- **Cause:** I wrote a header comment that showed the ERB tags literally, with `...` between them. Rails runs the whole file through ERB before it parses the YAML. ERB does not know what a YAML comment is, so it tried to run `...` as Ruby.
- **Fix:** the comment now describes the tags in words and never writes them.
- **Regression test:** `apps/core-api/test/integration/boot_test.rb`. Rails cannot load at all with this file broken, so every test in the suite fails, starting with "the health check answers 200".
- **What it taught me:** in a Rails YAML config, a comment is not inert. The same holds for any `.yml` file Rails loads with ERB, fixtures included.
