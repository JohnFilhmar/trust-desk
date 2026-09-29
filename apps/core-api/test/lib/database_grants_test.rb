# What: tests for the least-privilege policy in lib/database_grants.rb.
# Convention: tests for code in lib/ go in test/lib/. ActiveSupport::TestCase
#   is the base class for tests that send no HTTP request.
# Closest equivalent: a Jest unit test of a pure function.

require "test_helper"

class DatabaseGrantsTest < ActiveSupport::TestCase
  USERNAMES = { core_api: "td_core_api", handlers: "td_handlers" }.freeze

  test "every user is stripped of all privileges before any grant" do
    sql = DatabaseGrants.statements(database: "trust_desk_test", usernames: USERNAMES)

    revoke_at = sql.index("REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'td_handlers'@'%'")
    grant_at = sql.index { |line| line.start_with?("GRANT") && line.include?("td_handlers") }

    assert_not_nil revoke_at
    assert_not_nil grant_at
    assert_operator revoke_at, :<, grant_at
  end

  test "the handlers user is never granted a write on any table" do
    sql = DatabaseGrants.statements(database: "trust_desk_test", usernames: USERNAMES)
    handlers_grants = sql.select { |line| line.start_with?("GRANT") && line.include?("td_handlers") }

    assert_not_empty handlers_grants
    handlers_grants.each do |line|
      assert_no_match(/UPDATE|DELETE|DROP|ALTER|CREATE/, line)
    end
  end

  test "no user is granted a privilege on the whole database" do
    sql = DatabaseGrants.statements(database: "trust_desk_test", usernames: USERNAMES)

    sql.select { |line| line.start_with?("GRANT") }.each do |line|
      assert_no_match(/\.\*/, line)
    end
  end

  test "a name that could break out of the SQL text is refused" do
    assert_raises(ArgumentError) do
      DatabaseGrants.statements(database: "x`; DROP DATABASE y; --", usernames: USERNAMES)
    end
    assert_raises(ArgumentError) do
      DatabaseGrants.statements(
        database: "trust_desk_test",
        usernames: USERNAMES.merge(handlers: "td'@'%' WITH GRANT OPTION; --")
      )
    end
  end
end
