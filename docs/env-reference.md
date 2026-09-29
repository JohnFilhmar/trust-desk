# Environment variables

Every variable the production stack reads. No real value appears here.

Development needs no env file. Its made-up values are written in `docker-compose.dev.yml`, and each one carries `not-a-secret` in its text.

## Why this is not `.env.example`

The brief asks for a `.env.example`. My Claude Code settings deny any write to a path starting with `.env`, so the agent could not create one and did not work around the rule. To create it yourself, copy the block below into a file named `.env.example` at the repository root.

## For production

On the server, by hand: create a file named `.env` next to the Compose file, paste the block below, and fill in each empty value. Generate each secret there with `openssl rand -hex 32`. That file is never committed and never leaves the server.

```dotenv
# --- Database ---------------------------------------------------------------
DB_HOST=mysql
DB_PORT=3306
DB_NAME=trust_desk_production
DB_TEST_NAME=trust_desk_test

# Used once, when the MySQL data directory is first created.
MYSQL_ROOT_PASSWORD=

# Migrations, grants, seeds and the demo reset. No running service uses it.
DB_ADMIN_USERNAME=td_admin
DB_ADMIN_PASSWORD=

# The Rails runtime user.
DB_CORE_API_USERNAME=td_core_api
DB_CORE_API_PASSWORD=

# The handlers runtime user.
DB_HANDLERS_USERNAME=td_handlers
DB_HANDLERS_PASSWORD=

# --- Handlers ---------------------------------------------------------------
NODE_ENV=production
HANDLERS_PORT=8787
LOG_LEVEL=info
# The origin the browser uses. State-changing requests from any other
# origin are refused. Several origins are separated by commas. Production
# has one. The session cookie carries Secure only when every origin is https.
APP_ORIGINS=https://trust.filhmar.online
CORE_API_URL=http://core-api:3000
# Signs the session cookie. At least 32 characters.
SESSION_SECRET=

# --- Shared by the handlers and Rails ---------------------------------------
# Signs every call from the handlers to Rails. At least 32 characters.
# Both services must hold the same value.
SERVICE_HMAC_SECRET=

# --- Rails ------------------------------------------------------------------
RAILS_ENV=production
RAILS_LOG_LEVEL=info
RAILS_MAX_THREADS=3
# Rails refuses to boot in production without it.
SECRET_KEY_BASE=
```

## Who reads what

| Variable | MySQL | Migrate | Rails | Handlers |
|---|---|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME` | | yes | yes | yes |
| `MYSQL_ROOT_PASSWORD` | yes | | | |
| `DB_ADMIN_USERNAME`, `DB_ADMIN_PASSWORD` | yes | yes | | |
| `DB_CORE_API_USERNAME` | yes | yes | yes | |
| `DB_CORE_API_PASSWORD` | yes | | yes | |
| `DB_HANDLERS_USERNAME` | yes | yes | | yes |
| `DB_HANDLERS_PASSWORD` | yes | | | yes |
| `SERVICE_HMAC_SECRET` | | | yes | yes |
| `SESSION_SECRET` | | | | yes |
| `APP_ORIGINS`, `CORE_API_URL`, `HANDLERS_PORT`, `LOG_LEVEL` | | | | yes |
| `SECRET_KEY_BASE`, `RAILS_*` | | yes | yes | |

Rails reads its database user from `DB_USERNAME` and `DB_PASSWORD`. Compose sets those two from the admin pair for the migrate container and from the core-api pair for the Rails container, so the same image connects as a different user depending on its job.
