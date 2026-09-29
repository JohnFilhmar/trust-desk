# What: empties every table the seed fills, so the seed can also reset the
#   demo.
# Convention: none. db/seeds.rb loads this file with require_relative.
# Closest equivalent: a reset script run before a Prisma or TypeORM seed.
#
# It must run as the admin database user. TRUNCATE needs the DROP privilege,
# which no runtime user holds.

module Seeds
  module Reset
    # Every table of the app. A test compares this list with the database,
    # so a new table cannot be forgotten here.
    TABLES = %w[
      account_daily_stats events enforcement_actions audit_logs
      operational_modes signed_request_nonces idempotency_keys
      accounts staff_users
    ].freeze

    # Makes the method callable on the module itself: Seeds::Reset.truncate_all!
    module_function

    # DELETE would be refused by the trigger on audit_logs. TRUNCATE drops
    # and recreates the table, which fires no trigger and restarts the ids
    # at 1. MySQL refuses to truncate a table that a foreign key points at,
    # so the check is switched off for this connection while the tables are
    # emptied.
    def truncate_all!(connection = ActiveRecord::Base.connection)
      connection.execute("SET FOREIGN_KEY_CHECKS = 0")
      TABLES.each do |table|
        connection.execute("TRUNCATE TABLE #{connection.quote_table_name(table)}")
      end
    # `ensure` runs whether the lines above raised or not.
    ensure
      connection.execute("SET FOREIGN_KEY_CHECKS = 1")
    end
  end
end
