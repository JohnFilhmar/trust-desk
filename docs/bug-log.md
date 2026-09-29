# Bug log

Every bug found during the build, with the test that now catches it. Newest first.

## 001: a comment in `database.yml` stopped Rails from booting

- **Found:** 2026-09-30, Phase 0, when the migrate container exited with code 1.
- **Symptom:** `bin/rails aborted! SyntaxError: --> /app/config/database.yml` followed by `unexpected ':', expecting end-of-input`.
- **Cause:** I wrote a header comment that showed the ERB tags literally, with `...` between them. Rails runs the whole file through ERB before it parses the YAML. ERB does not know what a YAML comment is, so it tried to run `...` as Ruby.
- **Fix:** the comment now describes the tags in words and never writes them.
- **Regression test:** `apps/core-api/test/integration/boot_test.rb`. Rails cannot load at all with this file broken, so every test in the suite fails, starting with "the health check answers 200".
- **What it taught me:** in a Rails YAML config, a comment is not inert. The same holds for any `.yml` file Rails loads with ERB, fixtures included.
