# What: tests for the service that changes the operational mode, without
#   HTTP.
# Convention: tests for app/services/change_operational_mode.rb go in
#   test/services/change_operational_mode_test.rb.
# Closest equivalent: a Jest test of a NestJS provider against a real database.

require "test_helper"

class ChangeOperationalModeTest < ActiveSupport::TestCase
  REASON = "Signup burst from one network in the last hour."
  CORRELATION_ID = "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f"
  WRITES = [ "OperationalMode.count", "AuditLog.count" ].freeze

  # A service whose audit write always fails.
  class FailingAuditChangeOperationalMode < ChangeOperationalMode
    private

    def write_audit_log(_operational_mode, _previous_mode)
      raise ActiveRecord::StatementInvalid, "the audit write failed"
    end
  end

  test "it writes the mode and the audit row" do
    result = nil

    assert_difference WRITES, 1 do
      result = change_to("lockdown")
    end

    assert_equal "lockdown", OperationalMode.current
    assert_equal REASON, result.operational_mode.reason
    assert_equal staff_users(:enforcer).id, result.operational_mode.staff_user_id
    assert_equal "mode.change", result.audit_log.action
    assert_nil result.audit_log.account_id
    assert_equal(
      { "previous_mode" => "normal", "new_mode" => "lockdown", "reason" => REASON },
      AuditLog.find(result.audit_log.id).details
    )
  end

  test "when the audit row cannot be written, the mode is not kept either" do
    assert_no_difference WRITES do
      assert_raises(ActiveRecord::StatementInvalid) do
        FailingAuditChangeOperationalMode.new(
          staff_user: staff_users(:enforcer), mode: "lockdown",
          reason: REASON, correlation_id: CORRELATION_ID
        ).call
      end
    end

    assert_equal "normal", OperationalMode.current
    assert_lock_is_free
  end

  test "the mode in force is refused and nothing is written" do
    change_to("elevated")

    assert_no_difference WRITES do
      assert_raises(ChangeOperationalMode::ModeUnchanged) { change_to("elevated") }
    end
    assert_lock_is_free
  end

  test "an unknown mode and a bad reason are refused before the lock is taken" do
    assert_no_difference WRITES do
      assert_raises(ChangeOperationalMode::InvalidMode) { change_to("panic") }
      assert_raises(ChangeOperationalMode::InvalidMode) { change_to(nil) }
      assert_raises(Reason::Invalid) { change_to("elevated", reason: "too short") }
    end
  end

  # This test takes five seconds, which is how long the service waits.
  test "it gives up when another connection holds the lock" do
    # A second connection to the same database, opened with the driver
    # itself. During a test Rails hands out one and the same connection to
    # everyone who asks, and a lock held by a connection does not stop that
    # same connection.
    settings = ActiveRecord::Base.connection_db_config.configuration_hash
    other = Mysql2::Client.new(settings.slice(:host, :port, :username, :password, :database))
    taken = other.query("SELECT GET_LOCK('trust_desk_operational_mode', 0) AS taken").first
    assert_equal 1, taken["taken"]

    assert_no_difference WRITES do
      assert_raises(ChangeOperationalMode::Busy) { change_to("elevated") }
    end
  ensure
    # Closing the connection gives the lock back.
    other&.close
  end

  private

  def change_to(mode, reason: REASON)
    ChangeOperationalMode.new(
      staff_user: staff_users(:enforcer), mode: mode, reason: reason, correlation_id: CORRELATION_ID
    ).call
  end

  def assert_lock_is_free
    free = ActiveRecord::Base.connection.select_value(
      "SELECT IS_FREE_LOCK('trust_desk_operational_mode')"
    )

    assert_equal 1, free
  end
end
