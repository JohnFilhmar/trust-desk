# What: the list of what each runtime database user may do, and the code
#   that turns the list into GRANT statements.
# Convention: config.autoload_lib in config/application.rb makes every file
#   under lib/ loadable by its constant name, so nothing requires this file.
#   The file is database_grants.rb, so Rails expects it to define
#   DatabaseGrants.
# Closest equivalent: a plain module in src/lib of a Node service.
#
# This is the whole least-privilege policy in one place. A table that is not
# listed for a user cannot be read or written by that user.

module DatabaseGrants
  # `%w[a b]` is shorthand for ["a", "b"].
  # `.freeze` makes the object read-only, so nothing can add a grant at runtime.
  POLICY = {
    core_api: {
      "schema_migrations" => %w[SELECT],
      "ar_internal_metadata" => %w[SELECT],
      "signed_request_nonces" => %w[SELECT INSERT DELETE]
    },
    handlers: {
      "schema_migrations" => %w[SELECT]
    }
  }.freeze

  IDENTIFIER = /\A[a-z0-9_]+\z/

  # A module's methods are called on the module itself after this line:
  # DatabaseGrants.statements(...), with no instance.
  module_function

  # Builds the SQL without running it, so a test can read it.
  #
  # database  - name of the database the grants apply to
  # usernames - hash such as { core_api: "td_core_api", handlers: "td_handlers" }
  #
  # Returns an array of SQL strings. Each user is first stripped of every
  # privilege, so removing a line from POLICY removes the grant on the next run.
  def statements(database:, usernames:)
    check_identifier!(database)

    # flat_map runs the block for each pair and joins the resulting arrays.
    POLICY.flat_map do |role, tables|
      username = usernames.fetch(role)
      check_identifier!(username)

      revoke = "REVOKE ALL PRIVILEGES, GRANT OPTION FROM '#{username}'@'%'"
      grants = tables.map do |table, privileges|
        check_identifier!(table)
        "GRANT #{privileges.join(', ')} ON `#{database}`.`#{table}` TO '#{username}'@'%'"
      end

      [ revoke, *grants ]
    end
  end

  # Runs the statements on the current connection, which must belong to the
  # admin user.
  def apply!(connection: ActiveRecord::Base.connection, env: ENV)
    usernames = {
      core_api: env.fetch("DB_CORE_API_USERNAME"),
      handlers: env.fetch("DB_HANDLERS_USERNAME")
    }

    statements(database: connection.current_database, usernames: usernames).each do |sql|
      connection.execute(sql)
    end
  end

  # Names are placed inside SQL text, so anything but lowercase letters,
  # digits and underscores is refused. A method name ending in `!` warns
  # that it raises or changes something.
  def check_identifier!(name)
    return if IDENTIFIER.match?(name.to_s)

    raise ArgumentError, "Not a safe SQL identifier: #{name.inspect}"
  end
end
