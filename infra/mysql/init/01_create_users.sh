#!/bin/sh
# Runs once, when the MySQL data directory is first created.
# The official image executes every file in /docker-entrypoint-initdb.d.
#
# It creates the databases and the three users. It grants nothing on any
# table, because no table exists yet: MySQL rejects a grant on a table it
# cannot find. Table grants are applied after the migrations, by
# `bin/rails db:grants` in apps/core-api.
set -eu

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;
CREATE DATABASE IF NOT EXISTS \`${DB_TEST_NAME}\`;

-- Migrations, grants, seeds, resets and the test suite. No running service uses it.
CREATE USER IF NOT EXISTS '${DB_ADMIN_USERNAME}'@'%' IDENTIFIED BY '${DB_ADMIN_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_ADMIN_USERNAME}'@'%';
GRANT ALL PRIVILEGES ON \`${DB_TEST_NAME}\`.* TO '${DB_ADMIN_USERNAME}'@'%';
-- The admin user hands out table grants to the two users below.
GRANT CREATE USER ON *.* TO '${DB_ADMIN_USERNAME}'@'%';
GRANT GRANT OPTION ON \`${DB_NAME}\`.* TO '${DB_ADMIN_USERNAME}'@'%';

-- The Rails runtime user. Table grants come later.
CREATE USER IF NOT EXISTS '${DB_CORE_API_USERNAME}'@'%' IDENTIFIED BY '${DB_CORE_API_PASSWORD}';

-- The handlers runtime user. Table grants come later.
CREATE USER IF NOT EXISTS '${DB_HANDLERS_USERNAME}'@'%' IDENTIFIED BY '${DB_HANDLERS_PASSWORD}';

FLUSH PRIVILEGES;
SQL
