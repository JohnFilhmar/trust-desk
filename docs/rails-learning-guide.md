# Rails learning guide

My Ruby and Rails textbook for this codebase. It grows with each phase. Every claim here points at a file in this repository.

Status: covers Phase 0. The brief allows this guide to trail the code by one phase. It must be complete before Phase 2 is called done.

## How the app was generated

Ruby is not installed on my machine. The generator ran inside a throwaway container:

```
rails _8.1.4_ new core-api --api --database=mysql --skip-git --skip-docker \
  --skip-action-mailer --skip-action-mailbox --skip-action-text \
  --skip-active-job --skip-active-storage --skip-action-cable \
  --skip-asset-pipeline --skip-javascript --skip-hotwire --skip-jbuilder \
  --skip-system-test --skip-thruster --skip-ci --skip-kamal --skip-solid \
  --skip-devcontainer
```

| Flag | What it left out | Why |
|---|---|---|
| `--api` | views, cookies, sessions, flash, the asset pipeline | This app answers JSON to one caller. The handlers own the session |
| `--database=mysql` | nothing, it picks the `mysql2` gem and writes `database.yml` for it | The team uses MySQL |
| `--skip-git` | `git init`, `.gitignore`, `.gitattributes` | The app sits inside a repository that already exists. The ignore rules are in the root `.gitignore` |
| `--skip-docker` | the generated `Dockerfile` | I wrote a shorter one that I can explain |
| `--skip-action-mailer`, `--skip-action-mailbox` | sending and receiving email | Not used |
| `--skip-action-text`, `--skip-active-storage` | rich text and file uploads | Not used |
| `--skip-active-job`, `--skip-solid` | background jobs and their database-backed queue | The app has no background work |
| `--skip-action-cable` | WebSockets | Not used |
| `--skip-asset-pipeline`, `--skip-javascript`, `--skip-hotwire` | front-end tooling | The front end is the React app |
| `--skip-jbuilder` | a template language for JSON | Plain Ruby serializers, per ADR 002 |
| `--skip-system-test` | browser tests driven by Rails | Playwright covers that, in `e2e/` |
| `--skip-thruster`, `--skip-kamal` | an HTTP proxy and a deploy tool | Host nginx and Compose do those jobs |
| `--skip-ci` | a generated GitHub workflow | The root workflow covers every app |

Kept on purpose: RuboCop, Brakeman, bundler-audit, bootsnap and the test framework.

## Bundler, next to pnpm

| Ruby | Node | Job |
|---|---|---|
| gem | package | a library |
| `Gemfile` | `package.json` | what the app asks for, with version ranges |
| `Gemfile.lock` | `pnpm-lock.yaml` | what was resolved, exactly |
| `bundle install` | `pnpm install` | fetch what the lockfile names |
| `bundle exec x` | `pnpm exec x` | run a tool from the installed set |
| `bin/rails` | an npm script | a small launcher committed to the repository |

`~> 8.1.4` in the Gemfile means "8.1.4 or later, below 8.2". It is close to `~8.1.4` in npm.

`group :development, :test do ... end` in the Gemfile is the same idea as `devDependencies`.

## File map of `apps/core-api`

G means generated and untouched. E means generated and then edited. W means written for this project.

| File | | What it is |
|---|---|---|
| `Gemfile` | E | Dependencies. `bcrypt` was switched on |
| `Gemfile.lock` | G | Exact resolved versions |
| `.ruby-version` | G | The Ruby version, read by version managers and by CI |
| `Rakefile` | G | Loads the app's tasks, so `bin/rails db:grants` exists |
| `config.ru` | G | The entry point Puma loads. `ru` stands for rackup |
| `Dockerfile` | W | Three stages: base, dev, prod |
| `bin/rails`, `bin/rake`, `bin/setup`, `bin/dev`, `bin/ci` | G | Launchers |
| `bin/rubocop`, `bin/brakeman`, `bin/bundler-audit` | G | Launchers for the three checks |
| `config/application.rb` | E | Settings for every environment. Sets UTC and the SQL schema format |
| `config/boot.rb`, `config/environment.rb` | G | Boot order. Not something to edit |
| `config/database.yml` | E | Database settings, all read from the environment |
| `config/routes.rb` | G | The URL table. One route so far, `/up` |
| `config/puma.rb` | G | Web server settings |
| `config/environments/development.rb` | E | Allows the host name `core-api` |
| `config/environments/production.rb` | E | Turns off the SSL redirect, allows one host name |
| `config/environments/test.rb` | G | Settings for the test suite |
| `config/initializers/cors.rb` | G | Commented out. The browser never calls this app |
| `config/initializers/filter_parameter_logging.rb` | G | Keeps passwords and tokens out of the log |
| `config/initializers/inflections.rb` | G | Where you would teach Rails an odd plural |
| `config/locales/en.yml` | G | Translations |
| `config/credentials.yml.enc`, `config/master.key` | G | Encrypted secrets and their key. Kept, not used. `master.key` is ignored by git |
| `config/ci.rb`, `config/bundler-audit.yml`, `.rubocop.yml` | G | Settings for the checks |
| `app/controllers/application_controller.rb` | G | The parent of every controller |
| `app/models/application_record.rb` | G | The parent of every model |
| `db/migrate/20260930000001_create_signed_request_nonces.rb` | W | The first migration |
| `db/structure.sql` | G | The schema as SQL, written by Rails after each migration |
| `db/seeds.rb` | G | Empty until Phase 1 |
| `lib/database_grants.rb` | W | The least-privilege policy |
| `lib/tasks/grants.rake` | W | The `db:grants` command |
| `test/test_helper.rb` | E | Test setup. One parallel worker |
| `test/integration/boot_test.rb` | W | The app boots, routes and reaches MySQL |
| `test/lib/database_grants_test.rb` | W | The grants policy |

## Concepts introduced so far

### Environments

Rails runs in one of three modes, chosen by `RAILS_ENV`: `development`, `test` or `production`. It loads `config/application.rb` first and then `config/environments/<mode>.rb`, which can override it.

Node has `NODE_ENV`, but nothing in Node loads a file because of it. In Rails the file loading is built in.

Where: `config/environments/`.

### `database.yml` and ERB

The file is run through ERB, a template language, and only then parsed as YAML. Ruby between the ERB tags is executed. That is how the file reads environment variables.

The trap, which I hit: ERB runs over comments too. See `docs/bug-log.md`, entry 001.

`<<: *default` is YAML, not Rails. `&default` names a block and `<<: *default` copies it in.

Where: `config/database.yml`.

### Migrations

One file per schema change, run in the order of the number in the file name. Rails records which ones ran in the `schema_migrations` table.

`def change` describes only the forward step. For `create_table`, `add_index` and most others, Rails knows the reverse and can roll back without being told how.

The class name must be the file name in CamelCase. `create_signed_request_nonces.rb` must define `CreateSignedRequestNonces`. Get it wrong and Rails cannot find the class.

Where: `db/migrate/`.

### `structure.sql`, and why not `schema.rb`

After a migration, Rails writes the whole current schema to one file. The test database is built from that file, not by running the migrations again.

By default the file is `db/schema.rb`, written in Ruby. It can describe tables and indexes. It cannot describe a trigger. Phase 1 adds a trigger that makes the audit table append-only, so a test database built from `schema.rb` would be missing it.

`config.active_record.schema_format = :sql` makes Rails write `db/structure.sql` by calling `mysqldump`. That captures everything the database holds.

Where: `config/application.rb`, `db/structure.sql`.

### Rake tasks

A rake task is a command. `bin/rails db:migrate` is one that ships with Rails. `bin/rails db:grants` is one I added.

`task grants: :environment` means "load the Rails app, then run this block". Without `:environment` the task would have no models and no database connection.

Where: `lib/tasks/grants.rake`.

### Autoloading

Nothing in this app says `require "database_grants"`. Rails sees the constant `DatabaseGrants`, turns it into the file name `database_grants.rb`, and looks for it in the folders it knows. The loader is called Zeitwerk.

The rule runs both ways. The file name decides which constant Rails expects inside. A file named `database_grants.rb` that defines `DbGrants` raises an error at boot in production.

Where: `config.autoload_lib` in `config/application.rb`, and `lib/database_grants.rb`.

### Tests

| Minitest | Jest |
|---|---|
| `class BootTest < ActionDispatch::IntegrationTest` | `describe("boot", ...)` |
| `test "the health check answers 200" do` | `it("answers 200", ...)` |
| `assert_equal 1, value` | `expect(value).toBe(1)` |
| `assert_response :success` | `expect(res.status).toBe(200)` |
| `ActiveSupport::TestCase` | a test with no HTTP |
| `ActionDispatch::IntegrationTest` | a supertest test |

Note the order in `assert_equal`: expected first, actual second. It is the reverse of Jest.

Each test runs inside a database transaction that is rolled back at the end, so tests do not see each other's rows.

Where: `test/`.

## Ruby, for a TypeScript developer

Each entry points at a line in this repository.

| Ruby | Meaning | Where |
|---|---|---|
| `:success`, `:utc` | A symbol. An immutable name, used where TypeScript would use a string literal type | `test/integration/boot_test.rb` |
| `{ core_api: "x" }` | A hash with symbol keys. Same as `{ :core_api => "x" }` | `lib/database_grants.rb` |
| `{ "schema_migrations" => [...] }` | A hash with string keys. `:a` and `"a"` are different keys | `lib/database_grants.rb` |
| `%w[SELECT INSERT]` | `["SELECT", "INSERT"]` | `lib/database_grants.rb` |
| `.freeze` | Makes an object read-only, like `Object.freeze` | `lib/database_grants.rb` |
| `do \|role, tables\| ... end` | A block. An anonymous function passed to a method, like an arrow function argument | `lib/database_grants.rb` |
| no `return` on the last line | A method returns the value of its last expression | `statements` in `lib/database_grants.rb` |
| `check_identifier!` | A name ending in `!` warns that the method raises or changes something. It is a convention, not syntax | `lib/database_grants.rb` |
| `match?`, `exist?` | A name ending in `?` returns true or false | `lib/database_grants.rb` |
| `return if condition` | A guard clause. The condition comes after | `lib/database_grants.rb` |
| `def statements(database:, usernames:)` | Keyword arguments. The caller must name them | `lib/database_grants.rb` |
| `[ revoke, *grants ]` | The splat. Same as `[revoke, ...grants]` | `lib/database_grants.rb` |
| `"#{username}"` | String interpolation, in double quotes only | `lib/database_grants.rb` |
| `module_function` | Makes a module's methods callable on the module itself | `lib/database_grants.rb` |
| `ENV["X"] \|\|= "test"` | Assign only when the left side is nil or false | `test/test_helper.rb` |
| `ENV.fetch("X")` | Read a key and raise when it is missing. `ENV["X"]` returns nil without complaint | `config/database.yml` |

One thing to unlearn from JavaScript: only `nil` and `false` are falsy. `0` and `""` are truthy.

## The daily commands

`dc` stands for `docker compose -f docker-compose.dev.yml`. Type it in full.

| I want to | Command |
|---|---|
| start everything | `dc up --build` |
| see the URL table | `dc exec core-api bin/rails routes` |
| open a Ruby prompt with the app loaded | `dc exec core-api bin/rails console` |
| run the migrations and the grants | `dc run --rm migrate bin/rails db:prepare db:grants` |
| see which migrations ran | `dc run --rm migrate bin/rails db:migrate:status` |
| run the tests | `dc run --rm -e RAILS_ENV=test migrate sh -c "bin/rails db:test:prepare && bin/rails test"` |
| run one test file | the same, ending in `bin/rails test test/lib/database_grants_test.rb` |
| check style | `dc run --rm migrate bin/rubocop` |
| scan for security problems | `dc run --rm migrate bin/brakeman --no-pager` |

Why two services for one app: `migrate` connects as the admin database user and `core-api` as the runtime user. The runtime user cannot create a table, so a migration run from `core-api` fails.

## Still to come

Written in Phases 1 and 2: the request lifecycle, controllers and strong params, models and validations, associations, scopes, enums, transactions and locking, concerns, service objects, `rescue_from`, `CurrentAttributes`, serializers, tagged logging, fixtures, debugging, the list of Rails magic, where this app departs from stock Rails, and the 30-minute reading path.
