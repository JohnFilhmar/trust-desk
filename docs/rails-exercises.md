# Rails exercises

Eight exercises I do myself, easiest first. The AI wrote the tasks and the checks. It did not write the solutions into this file, and I asked it not to solve them for me.

Each one names the goal, the concept, the files, and a check that tells me I got it right. Do them in order: each builds on the one before.

## Before starting

```
git switch -c rails-exercises
docker compose -f docker-compose.dev.yml up --build
```

`dc` below stands for `docker compose -f docker-compose.dev.yml`. Type it in full.

Run the Rails tests after every exercise. All of them must still pass:

```
dc run --rm -e RAILS_ENV=test migrate sh -c "bin/rails db:test:prepare && bin/rails test"
```

Rules I set for myself:

- Write the test first and watch it fail for the right reason.
- Add the header comment to every new file, in the format the other files use.
- When stuck for more than 15 minutes, read `docs/rails-learning-guide.md` before asking the AI. When I do ask, I ask it to explain, not to write.

## 1. Explore the models in the console

**Concept:** ActiveRecord queries, associations, enums.

**Goal:** answer eight questions using the console only. Write each answer down with the line of Ruby that produced it.

```
dc exec core-api bin/rails console
```

1. How many accounts are suspended?
2. What is the email of account 189, and which accounts share its device fingerprint?
3. How many events does the account `miner-01@example.com` have, and how many of them are `cpu_spike`?
4. Which permissions does the analyst hold that the viewer does not?
5. What is the newest audit row, and who wrote it?
6. What does `Account.suspended.to_sql` print, and what does that tell you about what an enum adds?
7. What happens when you run `AuditLog.first.update(action: "pii.reveal")`? Which of the three layers refused it?
8. What happens when you run `Account.first.update(email: "x@example.com")`? Which layer refused it?

**Files to read first:** `app/models/account.rb`, `app/models/audit_log.rb`, `app/models/staff_user.rb`.

**Check:** questions 7 and 8 both raise. For each one, name the exception class and the file that caused it. Then answer this: the console connects as the runtime database user. What would have happened in MySQL if Ruby had not refused first?

## 2. Add a validation, test first

**Concept:** validations, the test-first loop, fixtures.

**Goal:** an `OperationalMode` must have a reason of 10 to 500 characters, the same rule as an enforcement action. Today it only has to be present.

**Steps:**

1. Open `test/models/operational_mode_test.rb` and add three tests: a reason of 9 characters is invalid, a reason of 10 is valid, a reason of 501 is invalid.
2. Run that file alone. Two of the three must fail.
3. Change `app/models/operational_mode.rb` until all three pass.

**Files:** `app/models/operational_mode.rb`, `test/models/operational_mode_test.rb`. Read `app/models/enforcement_action.rb` to see how the same rule is written there.

**Check:** the three new tests pass, and so does every other test. Then answer: the seed writes one `operational_modes` row. Does the seed still run? Why does `insert_all` behave differently from `create!` here?

**Go further:** the rule now exists in two models. `lib/reason.rb` may already hold it. Make both models use one definition, without metaprogramming.

## 3. Add a scope and use it

**Concept:** scopes, chaining, reading the SQL a query produces.

**Goal:** `Account.flagged_as_spam` returns the accounts whose `spam_marked_at` is set, newest mark first.

**Steps:**

1. Write a test in `test/models/account_test.rb` that creates or loads two accounts, one marked and one not, and expects only the marked one.
2. Add the scope to `app/models/account.rb`.
3. In the console, chain it: `Account.suspended.flagged_as_spam.count`.

**Files:** `app/models/account.rb`, `test/models/account_test.rb`, `test/fixtures/accounts.yml`.

**Check:** the test passes. `Account.flagged_as_spam.to_sql` contains `IS NOT NULL` and an `ORDER BY`. Then answer: a scope and a class method that returns a relation look alike. What does a scope do differently when its body returns nil?

## 4. Add a column through a migration

**Concept:** migrations, reversibility, `structure.sql`, grants, serializers.

**Goal:** an enforcement action records the operational mode that was in force when it was taken, in a new column `mode_at_the_time`.

**Steps:**

1. Generate the migration inside the container, so the timestamp and the class name are right:
   ```
   dc run --rm migrate bin/rails generate migration AddModeAtTheTimeToEnforcementActions mode_at_the_time:string
   ```
2. Read what it generated. Add `null: false` and a default of `"normal"`. Add the header comment.
3. Run it, with the grants:
   ```
   dc run --rm migrate bin/rails db:migrate db:grants
   ```
4. Look at the diff of `db/structure.sql`.
5. Make the enforcement service set the column from `OperationalMode.current`, inside the lock.
6. Expose it in `app/serializers/enforcement_action_serializer.rb`.
7. Roll the migration back and forward again, to prove it is reversible:
   ```
   dc run --rm migrate bin/rails db:rollback
   dc run --rm migrate bin/rails db:migrate
   ```

**Files:** `db/migrate/`, `db/structure.sql`, `app/services/`, `app/serializers/enforcement_action_serializer.rb`, `lib/database_grants.rb`.

**Check:** a request test for suspend now fails, because the response no longer matches `packages/shared/fixtures/enforcement_result.json` key for key. That failure is the contract doing its job. Decide which side is right, then change the fixture, the zod schema in `packages/shared/src/schemas/enforcement.ts` and the tests on both sides until everything passes again.

Then answer: did the Rails runtime user need a new grant? Why, or why not?

## 5. Follow a request with a breakpoint

**Concept:** the request lifecycle, the `debug` gem, the development log.

**Goal:** stop a real suspend request at four places and write down what you see at each.

**Steps:**

1. Put `debugger` on the first line of each of these: `verify_signed_request` in the concern, `load_actor_who_may_enforce` in the controller, the `suspend` action, and inside the `with_lock` block of the service.
2. Run Rails attached to your terminal:
   ```
   dc stop core-api
   dc run --rm --name core-api-debug --service-ports core-api bin/rails server -b 0.0.0.0
   ```
   The handlers call Rails by the name `core-api`. Find out whether they can reach a container with another name, and if not, what to change. Working that out is part of the exercise.
3. Suspend an account from the console in the browser.
4. At each stop, print `params`, `request.headers["X-Signature"]`, `@actor`, `@account` and `correlation_id`. Note which of them exist yet.
5. In a second terminal, follow the log:
   ```
   dc exec core-api tail -f log/development.log
   ```

**Files:** `app/controllers/concerns/signed_request.rb`, `app/controllers/internal/accounts_controller.rb`, `app/services/`.

**Check:** draw the order of the four stops and what each one added. Then answer: at the fourth stop, which SQL statement was the last one in the log, and what does `FOR UPDATE` at its end mean for a second request on the same account? Remove every `debugger` line before you commit. RuboCop fails on one.

## 6. Find and fix an N+1 query

**Concept:** N+1 queries, `includes`, reading the SQL log.

**Goal:** a new rake task prints the last 20 audit rows with the actor's name and the account's status, and runs three queries, not forty-one.

**Steps:**

1. Create `lib/tasks/audit_report.rake` with a task `audit:recent` that loads `AuditLog.order(created_at: :desc).limit(20)` and prints, for each row, the action, `row.staff_user.display_name` and `row.account&.status`.
2. Run it and count the SELECT statements in `log/development.log`.
3. Fix it with `includes`.
4. Count again.

**Files:** `lib/tasks/`, `app/models/audit_log.rb`. Read `lib/tasks/grants.rake` for the shape of a task.

**Check:** the count drops from one query per row to three in total. Then answer: what is the difference between `includes`, `preload` and `eager_load`, and which one did Rails choose here?

## 7. Add a `warn` enforcement action, end to end

**Concept:** everything so far, in one feature. This is the closest exercise to a real ticket on the team.

**Goal:** an enforcer can warn an account. A warning records an enforcement action and an audit row, and changes nothing on the account. An account may be warned any number of times.

**Steps, in the order I would do them on the job:**

1. Write the request test first, in `test/controllers/internal/accounts_controller_test.rb`: success, a bad signature, a replayed request, a missing reason, the wrong group.
2. Add the route in `config/routes.rb`.
3. Add `warn` to the allowed action types of `EnforcementAction` and `account.warn` to the actions of `AuditLog`.
4. Add the service. Read how suspend, unsuspend and mark as spam share their steps, and follow that shape. Do not copy a whole class.
5. Add the controller action.
6. Run the tests. Then send a real signed request to the running container, the way the existing tests' helper does.
7. On the TypeScript side: add `warn` to `enforcement_action_type_schema` and `account.warn` to `audit_action_schema` in `packages/shared`, add `apps/handlers/src/handlers/warn_account.ts`, add its route, and extend the tests in `apps/handlers/src/lib/enforcement/run_enforcement.test.ts`.
8. Decide whether a warning should be refused in lockdown. Write down why, in a comment where the rule lives.

**Files:** all of the above.

**Check:** every test on both sides passes. The route table of the handlers still has no route without an `access`. Then answer three questions an interviewer would ask:

- Which files did a new action touch, and which of them would you remove from that list with a better design?
- The idempotency key: does a warning need one? What goes wrong without it?
- Where would you add the button in the console, and which permission shows it?

## 8. Break the signature, on purpose

**Concept:** security reasoning. Reading a test suite as a list of attacks.

**Goal:** for each change below, predict which test fails, make the change, run the tests, and see whether you were right. Undo each change before the next.

1. In `lib/request_signature.rb`, join the canonical string with an empty string in place of a newline.
2. In the concern, store the nonce before checking the signature.
3. In `lib/request_signature.rb`, compare with `==` in place of `secure_compare`.
4. In the concern, remove `.abs` from the timestamp check.
5. In the controller, read the permission from a `group_name` field of the request body in place of the database.

**Files:** `lib/request_signature.rb`, `app/controllers/concerns/signed_request.rb`, `app/controllers/internal/accounts_controller.rb`, and their tests.

**Check:** write one line per change: the test that caught it, or "no test caught it".

Change 3 is caught by no test, and cannot be by a normal one: a timing difference of nanoseconds does not show in a test that checks an answer. Write down how you would find that mistake in a code review, and what you would say in an interview when asked how you know the comparison takes constant time.

If any of the other four is caught by no test, that is a gap in the suite. Write the missing test. That one is a real contribution, and worth its own commit.

## Solutions

They belong on the branch `rails-exercises-solutions`. That branch does not exist yet.

The brief says two things that pull apart: the AI must not solve the exercises for me, and the solutions go on a separate branch. The AI raised that on the Phase 2 pull request and wrote no solutions. I decide there which I want: solutions from the AI to compare against, or my own.
