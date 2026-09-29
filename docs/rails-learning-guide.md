# Rails learning guide

My Ruby and Rails textbook for this codebase. It grows with each phase. Every claim here points at a file in this repository.

Status: complete for Phases 0 to 2, the core.

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

## The request lifecycle, step by step

One request, followed through every file it touches: an enforcer suspends account 42.

The handlers send this, on the internal Docker network:

```
POST /internal/accounts/42/suspend
X-Signature: 87f59f...
X-Signature-Timestamp: 1790726400
X-Signature-Nonce: 5f0c1b9e-2a3d-4c6f-8e7a-9b0c1d2e3f40
X-Correlation-Id: 3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f

{"actor_staff_user_id":3,"reason":"Twelve accounts share this fingerprint.","idempotency_key":null}
```

| Step | What happens | File |
|---|---|---|
| 1 | Puma, the web server, accepts the connection and hands the request to Rails | `config/puma.rb`, `config.ru` |
| 2 | The request passes through the Rack middleware, a chain of 19 small classes. One checks the Host header, one assigns a request id, one writes the log lines, one turns an exception into an error response. None of them parses the body: the request object does that when `params` is first read | `config/environments/*.rb` sets `config.hosts` |
| 3 | The router matches the method and the path, and picks `Internal::AccountsController#suspend` | `config/routes.rb` |
| 4 | Rails creates one new controller object for this request | `app/controllers/internal/accounts_controller.rb` |
| 5 | `before_action :verify_signed_request` runs. It checks the header formats, the timestamp, the signature, then stores the nonce | `app/controllers/concerns/signed_request.rb`, `lib/request_signature.rb`, `app/models/signed_request_nonce.rb` |
| 6 | `before_action :load_actor_who_may_enforce` loads staff user 3 and checks the permission | `app/controllers/internal/accounts_controller.rb`, `app/models/staff_user.rb` |
| 7 | `before_action :load_account` loads account 42 | same controller |
| 8 | The action `suspend` runs. It reads the reason through strong params and calls the service | same controller |
| 9 | The service validates the reason, locks the row, checks the status, and writes three rows in one transaction | `app/services/suspend_account.rb` |
| 10 | The serializer turns the result into a hash, field by field | `app/serializers/enforcement_result_serializer.rb` |
| 11 | `render json: ..., status: :created` turns the hash into JSON and sends 201 | the controller |
| 12 | If anything raised, `rescue_from` turned it into the error envelope | `app/controllers/internal/base_controller.rb` |

See the middleware chain of this app with:

```
dc run --rm migrate bin/rails middleware
```

A filter that renders a response stops the chain. That is how step 5 refuses a bad signature: `render_error` renders, so steps 6 to 11 never run. There is no `return next()` to forget, as there is in Express.

## Concepts, with where each one lives

### Routes

`config/routes.rb` is the only place a URL is declared. `namespace :internal` does two things at once: it puts `/internal` in front of every path inside the block, and it makes Rails look for the controllers in the module `Internal`, in `app/controllers/internal/`.

`"accounts#suspend"` reads as "the method `suspend` of `AccountsController`".

Express, NestJS: the router file, or the decorators on a controller. Django: `urls.py`.

### Controllers and actions

A controller is a class. Each public method is an action, which means a URL can reach it. Methods under `private` cannot be reached by a URL. That is a security rule as much as a style rule: a helper left public in a controller is a possible endpoint.

Rails makes a new controller object for every request, so an instance variable such as `@account` lives for one request and is never shared.

Where: `app/controllers/internal/accounts_controller.rb`.

### `before_action`

Runs a method before an action. Filters run in the order they are declared, parent class first. One that renders or redirects stops the request.

Express: middleware mounted on one router. NestJS: a guard.

Where: three of them in `accounts_controller.rb`, one in `signed_request.rb`.

### Strong params

`params` holds everything the request sent. Strong params is the rule that you must name a field to use it. `params.expect(:reason)` returns the value of `reason` and raises when it is missing, blank, or an array or object where one value was expected.

It exists because of mass assignment. Without it, `Account.update(params)` would let a caller set any column by adding a key to the request body.

zod does the same job in the handlers. The difference is that zod also checks the type and the length. In Rails, those checks live on the model as validations.

Where: `accounts_controller.rb`.

### Concerns

A module mixed into a class with `include`. `SignedRequest` holds the signature check, and every internal controller gets it through `Internal::BaseController`.

`extend ActiveSupport::Concern` gives the module the `included do ... end` block. The code in that block runs inside the class that includes the module, as if it were written there. That is how a module can declare a `before_action`.

Express: a middleware function. NestJS: a guard. TypeScript has no mixins built in, so this is the concept with the weakest equivalent.

Where: `app/controllers/concerns/signed_request.rb`.

### `rescue_from`

Maps an exception class to a method, for every action of a controller and its children. It is how one place turns every failure into the error envelope.

Rails tries the `rescue_from` lines from the bottom up. So the catch-all for `StandardError` is written first, and the specific classes after it.

Express: the error-handling middleware with four arguments. NestJS: an exception filter.

Where: `app/controllers/internal/base_controller.rb`.

### Models and ActiveRecord

A class that inherits from `ApplicationRecord` maps to a table. `StaffUser` maps to `staff_users` with no configuration, because Rails turns the class name into a plural, snake_case table name.

The class gets one reader and one writer per column, without any being declared. `account.status` works because the table has a `status` column. Rails reads the column list from the database at boot.

ActiveRecord is both the model and the query builder. `Account.find_by(id: 42)` returns a record or nil. `Account.find(42)` raises when nothing matches. This app uses `find_by` and answers 404 itself.

TypeORM, Prisma, Django ORM: the same idea. The difference is that a Rails model declares no columns.

Where: `app/models/`.

### Validations

Rules a model checks before a save. A record that fails is not written, and `record.errors` lists why.

```ruby
validates :reason, presence: true, length: { in: 10..500 }
```

`save` returns false on failure. `save!` raises. This app uses the `!` form inside transactions, because an exception is what rolls a transaction back.

A validation is not a database constraint. `validates :email, uniqueness: true` runs a SELECT first, and two requests arriving together can both pass it. The unique index is what settles that. This app has both, and says so in `staff_user.rb`.

Where: every model.

### Associations

`belongs_to :account` says this table has an `account_id` column, and adds `enforcement_action.account`. `has_many :events` adds `account.events`.

Since Rails 5, `belongs_to` also validates that the other record exists. `optional: true` switches that off. `AuditLog` uses it for the account, because a mode change concerns no single account.

Where: `app/models/enforcement_action.rb`, `account.rb`, `audit_log.rb`.

### Enums

```ruby
enum :status, { active: "active", suspended: "suspended" }
```

This one line adds `account.active?`, `account.suspended?`, the queries `Account.active` and `Account.suspended`, and refuses any other value.

The hash form stores the text in the column. The array form, `enum :status, [:active, :suspended]`, stores 0 and 1, which means reordering the array silently changes what every row means. This app always uses the hash form.

Where: `app/models/account.rb`.

### Callbacks

A method Rails calls at a fixed point in the life of a record: before validation, before save, after commit and so on.

This app uses one, `before_validation :strip_reason`, so that the length is measured on the text without the spaces around it.

It avoids more, on purpose. A callback runs on every save from anywhere, including from a test or the console, and nothing at the call site shows it. Business steps such as "write the audit row" live in a service object where they can be read top to bottom.

Where: `app/models/enforcement_action.rb`.

### Transactions and row locks

```ruby
@account.with_lock do
  raise AlreadySuspended if @account.suspended?
  action.save!
  @account.update!(status: "suspended")
  write_audit_log(action, previous_status)
end
```

`with_lock` does three things: opens a transaction, runs `SELECT ... FOR UPDATE` on this one row, and reloads the record from it. A second request for the same account waits on that line until the first block ends. It then reads the new status and raises.

The status is checked inside the block. Checked before it, the value in memory could be one another request has just changed.

An exception raised inside the block rolls back all three writes.

This is pessimistic locking. The other kind is optimistic: a `lock_version` column that Rails increments on every save, and a save that fails when the number has moved. Pessimistic was chosen because the second enforcer should get a clear 409 about the account's state, not a retry error about a version number.

Where: `app/services/suspend_account.rb`.

### Service objects

A plain Ruby class that holds one business operation. Rails has no folder for them. This app uses `app/services/`, which Rails autoloads like every folder directly under `app/`.

The reason to have them: a controller should read the request and write the response, and a model should describe one table. "Suspend an account" touches three tables and has rules of its own, so it fits neither.

`SuspendAccount.new(...).call` is the convention: build with the inputs, then one public method.

NestJS: a provider. There, the framework has a place for it.

Where: `app/services/suspend_account.rb`.

### Serializers

A plain Ruby class with an `as_json` method that returns a hash. Every field is written by hand, so a new column stays out of the response until someone adds it.

`render json: some_hash` turns a hash into JSON text. `render json: some_model` would send every column, which is why this app never does it.

Where: `app/serializers/`. The decision is in `docs/decisions/002-rails-serializers.md`.

### `has_secure_password`

One line that adds a `password=` writer, which stores a bcrypt hash in `password_digest`, and an `authenticate(password)` method. It needs the `bcrypt` gem and a column named exactly `password_digest`.

In this app Rails only writes the hash, in the seed. The handlers verify it at login with `bcryptjs`. An integration test proves that a hash written by Ruby is accepted by JavaScript: `apps/handlers/src/repositories/database.integration.test.ts`.

Where: `app/models/staff_user.rb`.

### Seeds

`db/seeds.rb` is a Ruby script. `bin/rails db:seed` runs it. It has no structure of its own, so this app splits it into plain classes under `db/seeds/`.

`insert_all` writes many rows in one statement. It skips validations and callbacks, which is why it is fast and why the seed builds its rows carefully.

The seed passes one `Random.new(20260930)` everywhere it needs randomness, so every run writes the same data. It prints a digest to prove it.

Where: `db/seeds.rb`, `db/seeds/`.

### Raw SQL in a migration

Rails has helpers for tables, columns and indexes. For anything else, `execute` runs SQL as written. The audit trigger is created that way.

A migration that uses `execute` needs `up` and `down` written out. `change` only works when Rails can work out the reverse by itself.

Where: `db/migrate/20260930000007_create_audit_logs.rb`.

### Generated columns

```ruby
t.virtual :signup_fingerprint, type: :string, stored: false,
  as: "(json_unquote(json_extract(`signup_context`, _utf8mb4'$.device_fingerprint')))"
```

MySQL computes the column from the JSON, and an index on it makes a search by fingerprint an index lookup. Rails calls these virtual columns. `stored: false` means MySQL keeps only the index on disk.

The handlers query the column by name. An integration test runs `EXPLAIN` to prove the index is used.

Where: `db/migrate/20260930000003_create_accounts.rb`.

## The magic list

Things Rails does that no line of code asks for. Each one confused me, or would have.

| What happens | Why | What to remember |
|---|---|---|
| `Account` finds the table `accounts` | Rails pluralizes the class name | A table named against the rule needs `self.table_name = "..."` |
| Nothing requires `suspend_account.rb` | Zeitwerk loads a file when its constant is first used | The file name decides the constant. `suspend_account.rb` must define `SuspendAccount` |
| A new folder under `app/` is not found until restart | Autoload paths are fixed at boot | Restart the server after adding `app/services/` or `app/serializers/` |
| `account.email` works with no `attr_reader` | Rails reads the columns from the database at boot | The schema is the source of truth for a model's fields |
| A column named `type` breaks the model | Rails uses `type` for single-table inheritance | Never name a column `type`. This app uses `event_type` and `action_type` |
| A controller action with no `render` looks for a template | Implicit rendering | In API mode it answers 204. This app always renders explicitly |
| A comment in `database.yml` ran as code | ERB runs over the whole file first | Never write ERB tags in a comment of a YAML file Rails loads |
| `created_at` fills in by itself | Rails sets it when the column exists | A table with `created_at` and no `updated_at` works with no configuration |
| `params` has a second copy of the body under `account` | `wrap_parameters` | This app switches it off in the base controller |
| `Time.now` and `Time.current` differ | `Time.current` uses the zone in `config.time_zone` | Always `Time.current`. This app runs in UTC, so the two agree here and would not elsewhere |
| A test's rows are gone afterwards | Each test runs in a transaction that is rolled back | Data a test needs comes from fixtures or is created inside the test |
| `0` and `""` are true | Only `nil` and `false` are falsy in Ruby | `if count` is always true. Write `if count > 0` |

## Where this app departs from stock Rails

So that I do not mistake my own choices for Rails conventions.

| This app | A stock Rails app | Why |
|---|---|---|
| API-only mode | Renders HTML views | The front end is a separate React app |
| No sessions, no cookies | Session cookie by default | The handlers own the session. Rails is never reached by a browser |
| Authenticates a service, with HMAC | Authenticates a user | Its one caller is another service |
| Trusts the staff user id in the signed body | Reads the user from its own session | The handlers authenticated the user. Rails checks the permission itself |
| `db/structure.sql` | `db/schema.rb` | The schema has triggers, which Ruby cannot describe |
| Environment variables for every secret | `config/credentials.yml.enc` | One mechanism for both services. The credentials file is kept and unused |
| Two database users, admin and runtime | One user that can do anything | Least privilege. The runtime user cannot create or drop a table |
| Column-level UPDATE grant on `accounts` | Table-level privileges | Rails may change a status, never an email |
| No background jobs | Active Job with Solid Queue | Nothing here runs in the background |
| Service objects in `app/services/` | Logic in models and controllers | Rails has no opinion. Many teams add this folder |
| Serializers in `app/serializers/` | Jbuilder templates, or `to_json` | Fields are listed by hand, per ADR 002 |
| Tests on one worker | One worker per processor | One test database is enough for a suite this size |
| Plain HTTP between services | `force_ssl` on | The network is private and the HMAC signature authenticates each call |

## Debugging

### Reading a stack trace

Read from the top, and skip to the first line that starts with `/app/`. Lines from `/usr/local/bundle/` are gem code. Rails traces are long because a request passes through every middleware, and each one adds a frame.

### The development log

```
dc exec core-api tail -f log/development.log
```

In development Rails writes to `log/development.log`, not to the container's output. So `dc logs core-api` shows little, and this file shows everything.

It logs every SQL statement with its timing. After each one, a line starting with `↳` names the file and line of this app that caused it:

```
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'td_core_api'@'%'
↳ lib/database_grants.rb:65:in 'block in DatabaseGrants.apply!'
```

That is the fastest way to find which line ran a query.

At debug level the log holds values, seeded emails among them. Production logs at `info`, which logs no SQL.

### A breakpoint

Write `debugger` on any line. Then run the server attached to a terminal:

```
dc run --rm --service-ports core-api bin/rails server -b 0.0.0.0
```

When a request reaches the line, the terminal stops there. `n` steps over, `s` steps in, `c` continues, and any Ruby expression is evaluated.

### The console

```
dc exec core-api bin/rails console
```

A Ruby prompt with the whole app loaded. It connects as the runtime user, so it can do what the running app can do and no more.

```ruby
Account.suspended.count
Account.find(189).signup_context
StaffUser.find_by(email: "analyst@example.com").permissions
OperationalMode.current
AuditLog.order(created_at: :desc).first
```

Add `--sandbox` to roll back everything on exit. For the database itself:

```
dc exec mysql mysql -utd_handlers -p trust_desk_development
```

## A 30-minute reading path

Read in this order. Each file builds on the one before.

| Minutes | File | What to look for |
|---|---|---|
| 2 | `config/routes.rb` | The whole surface of the app |
| 3 | `db/structure.sql` | The tables, the generated columns, the two triggers |
| 3 | `lib/database_grants.rb` | Who may do what, in one hash |
| 4 | `lib/request_signature.rb` | The signing scheme, with no Rails in it |
| 4 | `app/controllers/concerns/signed_request.rb` | The order of the checks, and why |
| 3 | `app/controllers/internal/base_controller.rb` | The error envelope and `rescue_from` |
| 3 | `app/controllers/internal/accounts_controller.rb` | A thin controller |
| 4 | `app/services/suspend_account.rb` | The lock and the transaction |
| 2 | `app/models/audit_log.rb` | Three layers of append-only |
| 2 | `test/controllers/internal/accounts_controller_test.rb` | The same story, told as what must be refused |

## Concepts added in Phase 2

### Inheritance and the template method

Suspend, unsuspend and mark as spam share every step and differ in four small answers. `AccountEnforcement` holds the steps. Each child holds the four answers.

```ruby
class UnsuspendAccount < AccountEnforcement
  private

  def action_type
    "unsuspend"
  end

  def check_state!
    raise NotSuspended unless @account.suspended?
    raise BlockedByLockdown if OperationalMode.current == "lockdown"
  end
end
```

`<` means "inherits from". Ruby has no `abstract` keyword, so the parent defines the four methods and makes each one raise `NotImplementedError`. A child that forgets one fails the first time it runs, not at compile time. That is the price of a language with no compiler, and the tests are what pay it.

The parent's header comment says why this shape was chosen over one class that takes a rule object.

TypeScript: an abstract class with three implementations.

Where: `app/services/account_enforcement.rb` and its three children.

### Exception hierarchies

```ruby
class AccountEnforcement
  class Refused < StandardError; end
end

class UnsuspendAccount < AccountEnforcement
  class NotSuspended < Refused; end
  class BlockedByLockdown < Refused; end
end
```

A class defined inside a class is namespaced by it: `UnsuspendAccount::NotSuspended`. Rescuing the parent catches every child, so the controller rescues `AccountEnforcement::Refused` once and looks up the code for the child it got.

`rescue Klass => name` gives the exception a name, like `catch (error)`.

Always inherit from `StandardError`, never from `Exception`. A bare `rescue` catches `StandardError` and its children. `Exception` also covers things such as the signal that stops the process, which no application code should catch.

Where: `app/services/`, `app/controllers/internal/accounts_controller.rb`.

### Blocks and `yield`

```ruby
answer = IdempotentRequest.new(key: key, ...).run do
  # the action
end
```

The code between `do` and `end` is a block. Inside `run`, `yield` executes it. So `run` decides whether the action runs at all, and wraps it in a transaction when it does.

A block is how Ruby passes a piece of work to a method. `with_lock do`, `transaction do` and `each do` are all the same idea.

TypeScript: passing an arrow function as the last argument.

Where: `app/services/idempotent_request.rb`.

### Idempotency, and how it differs from replay protection

Two layers that are easy to confuse:

| | Replay protection | Idempotency |
|---|---|---|
| Stops | the same signed request being accepted twice | the same intent acting twice |
| Keyed by | the nonce | the idempotency key |
| Made by | the handlers, fresh for every call | the browser, once per open dialog |
| A repeat gets | 401 `replayed_request` | the stored answer |
| Table | `signed_request_nonces` | `idempotency_keys` |

A retry from the browser arrives in a new signed request with a new nonce, so it passes the first layer and is caught by the second.

The stored answer is written in the same transaction as the action. So a stored answer exists exactly when the action happened.

Only a success is stored. A refusal raises, the transaction rolls back, and the analyst can fix the problem and send again with the same key.

Where: `app/services/idempotent_request.rb`, `app/models/idempotency_key.rb`.

### Nested transactions

`IdempotentRequest` opens a transaction, and the action inside it opens another with `with_lock`. Rails joins the two into one. There is one COMMIT, at the end of the outer block.

A consequence that surprises people: raising `ActiveRecord::Rollback` inside the inner block does not roll back the outer one. This app never uses `ActiveRecord::Rollback`. It raises real exceptions, which always travel outward.

### Advisory locks

An account has a row to lock. The operational mode has none, since every change is a new row. Two changes at once could both read "normal" as the previous mode.

An advisory lock is a lock on a name. MySQL gives the name to one connection at a time.

```ruby
SELECT GET_LOCK('trust_desk_operational_mode', 5)
```

The lock belongs to a connection. So taking it, the transaction and releasing it must all happen on the same one, which is what `ActiveRecord::Base.with_connection` guarantees.

Where: `app/services/change_operational_mode.rb`.

### `ensure`

Runs when the lines above it finish, and also when they raise. It is `finally`. The advisory lock is released in one, so a refused change does not keep the lock.

### `ActiveSupport::CurrentAttributes`

```ruby
class Current < ActiveSupport::CurrentAttributes
  attribute :correlation_id, :staff_user_id
end
```

`Current.correlation_id` looks like a global variable and is not one. Each thread has its own copy, and Puma serves each request on one thread.

Rails resets every attribute before and after each request. Puma reuses its threads, so without the reset the next request on the same thread would start with the staff user of the previous one.

It is easy to overuse. This app keeps two ids in it and passes everything else as an argument, so it stays clear what each method depends on.

Node: `AsyncLocalStorage`. NestJS: a request-scoped provider.

Where: `app/models/current.rb`.

### Tagged logging and lambdas

```ruby
config.log_tags = [ ->(request) { "correlation_id=#{CorrelationId.resolve(request)}" } ]
```

`->(request) { ... }` is a lambda, a function kept in a value. Rails calls it with the request in the logging middleware, before routing and before any controller. Whatever it returns is put in front of every log line of that request, Rails' own `Started` and `Completed` lines included.

Because it runs so early, the header is read and checked there. The id is then stored in the Rack env, the hash that travels with one request, so the controller gets the same value later.

Where: `config/application.rb`, `lib/correlation_id.rb`.

### Scopes

This app has no hand-written scope. It uses the ones `enum` generates: `Account.active` and `Account.suspended`.

A scope is a named query that returns a relation, so it chains: `Account.suspended.where(plan: "pro").count`. Exercise 3 adds one by hand.

### Fixtures

YAML files in `test/fixtures/`, one per table. Rails loads them into the test database before the suite, and each test runs in a transaction that is rolled back.

```yaml
enforcer:
  email: enforcer@example.com
  group_name: enforcer
```

In a test, `staff_users(:enforcer)` returns that row. The method is named after the table and the argument after the label.

Two things to know:

- A fixture is inserted directly. It skips validations and callbacks, so a fixture can hold a row the model would refuse.
- Fixture files go through ERB, like `database.yml`. The same trap applies to comments.

Where: `test/fixtures/`.

### What tests can and cannot do with connections

During a test Rails hands every caller the same database connection, so that everything sits inside the one transaction it will roll back. A lock taken through the pool therefore does not block the code under test. The test that proves the advisory lock makes a second caller wait opens a raw connection of its own with `Mysql2::Client.new`.

Where: `test/services/change_operational_mode_test.rb`.

## Every Ruby idiom in this codebase, in one table

Added to the primer above. Each one appears in the file named.

| Ruby | Meaning | Where |
|---|---|---|
| `class A < B` | A inherits from B | `app/services/suspend_account.rb` |
| `raise NotImplementedError` | How a parent marks a method the child must define | `app/services/account_enforcement.rb` |
| `InvalidReason = Reason::Invalid` | A constant as a second name for a class | `app/services/account_enforcement.rb` |
| `rescue Klass => name` | Catch and name the exception | `app/services/idempotent_request.rb` |
| `yield` | Run the block the caller passed | `app/services/idempotent_request.rb` |
| `ensure` | `finally` | `app/services/change_operational_mode.rb` |
| `->(x) { ... }` | A lambda | `config/application.rb` |
| `Data.define(:a, :b)` | A small immutable class with readers | `app/services/account_enforcement.rb` |
| `attr_reader :a` | Defines a reader method | `lib/request_signature.rb` |
| `def self.name` | A method on the class, not on an instance | `app/models/operational_mode.rb` |
| `module_function` | Makes a module's methods callable on the module | `lib/correlation_id.rb` |
| `@name` | An instance variable | every service |
| `@name \|\|= value` | Assign once, then reuse | `app/controllers/internal/base_controller.rb` |
| `value&.method` | Call only when not nil | `app/controllers/internal/accounts_controller.rb` |
| `return x unless y` | A guard clause | `app/models/audit_log.rb` |
| `a & b` on arrays | What both arrays hold | `app/models/audit_log.rb` |
| `a - b` on arrays | What the first holds and the second does not | `app/services/record_pii_reveal.rb` |
| `(10..500)` | A range, both ends included | `lib/reason.rb` |
| `...x` | A range with no start | `app/models/signed_request_nonce.rb` |
| `hash.sort.to_h` | A hash with its keys in order | `app/services/idempotent_request.rb` |
| `<<~SQL` | A multi-line string that drops the indentation | `db/migrate/20260930000007_create_audit_logs.rb` |
| `/\A...\z/` | A regex anchored to the whole string, not to a line | `app/controllers/concerns/signed_request.rb` |
| `\|a, b, c\|` | Block parameters that take a row apart | `db/seeds/enforcement_plan.rb` |

One of these is a security matter. In Ruby `^` and `$` match at every line break, so `/^[0-9a-f]+$/` accepts `"abc\n<anything>"`. `\A` and `\z` match the start and the end of the whole string. Every format check in this app uses them.

## File map of the code written in Phases 1 and 2

Every file here is W, written for this project.

| File | What it is |
|---|---|
| `config/routes.rb` | Six internal routes, the health check, and a catch-all that answers 404 in the envelope |
| `config/initializers/structure_dump.rb` | One flag for `mysqldump` |
| `config/initializers/filter_parameter_logging.rb` | What never appears in the `Parameters:` log line |
| `app/controllers/internal/base_controller.rb` | The signature check, the correlation id, the error envelope |
| `app/controllers/internal/accounts_controller.rb` | Suspend, unsuspend, mark as spam |
| `app/controllers/internal/reveals_controller.rb` | The audit row of a PII reveal |
| `app/controllers/internal/operational_modes_controller.rb` | A mode change |
| `app/controllers/internal/errors_controller.rb` | The catch-all |
| `app/controllers/concerns/signed_request.rb` | The order of the four checks |
| `app/models/staff_user.rb` | Groups and permissions |
| `app/models/account.rb` | The status enum, and three attributes that cannot change |
| `app/models/event.rb`, `account_daily_stat.rb` | Written by the seed, read by the handlers |
| `app/models/enforcement_action.rb` | The reason rule and the one callback |
| `app/models/audit_log.rb` | Append-only, and no PII in `details` |
| `app/models/operational_mode.rb` | `current`, the newest row |
| `app/models/signed_request_nonce.rb` | `remember` and `forget_expired` |
| `app/models/idempotency_key.rb` | One stored answer |
| `app/models/current.rb` | Two ids for the length of a request |
| `app/services/account_enforcement.rb` | The shared steps of an enforcement action |
| `app/services/suspend_account.rb`, `unsuspend_account.rb`, `mark_account_as_spam.rb` | Four answers each |
| `app/services/idempotent_request.rb` | Run once, answer many times |
| `app/services/record_pii_reveal.rb` | One audit row, field names only |
| `app/services/change_operational_mode.rb` | The advisory lock |
| `app/serializers/*.rb` | One hash per response, fields listed by hand |
| `lib/request_signature.rb` | The signing scheme, with no Rails in it |
| `lib/database_grants.rb` | Who may do what |
| `lib/correlation_id.rb`, `lib/uuid.rb`, `lib/reason.rb` | Three small rules, each in one place |
| `lib/tasks/grants.rake`, `seed_if_empty.rake` | Two commands |
| `db/migrate/*.rb` | Nine migrations, one table each |
| `db/seeds.rb`, `db/seeds/*.rb` | The demo data, deterministic |
| `test/support/signed_request_helper.rb` | Signs a request inside a test |
| `test/support/log_capture_helper.rb` | Reads what a request logged |

## Known limits of this guide

- The breakpoint procedure under "Debugging" was written from the `debug` gem's documented behavior. Exercise 5 is where I run it for the first time.
- Everything else here was checked against the running code on 2026-09-30.
