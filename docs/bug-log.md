# Bug log

Every bug found during the build, with the test that now catches it. Newest first.

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
