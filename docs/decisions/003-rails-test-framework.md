# 003: Rails test framework

Status: decided by me on 2026-09-29, recorded in the build brief.

## Context

Rails ships with Minitest. Many teams use RSpec. The rule I set was: Minitest, unless the job description names RSpec.

## Options

- **A.** Minitest, which `rails new` sets up.
- **B.** RSpec, through the `rspec-rails` gem.

## Decision

Option A.

The job description names Jest four times and names no Rails test framework. Its testing line reads: "Ship with tests every time: Jest unit and component tests, handler tests with mocked DB and auth, and a regression test for every bug fix."

## Consequences

- Nothing to install or configure. The generated `test/test_helper.rb` works as it is.
- A Minitest test is a plain Ruby class with methods, which is easier to read for someone new to Ruby than the RSpec language.
- If the team uses RSpec, I will need to learn its syntax. The ideas carry over: request tests, fixtures, assertions.
- `test/test_helper.rb` sets one parallel worker. A generated app uses one per processor and Rails then needs one database per worker.
