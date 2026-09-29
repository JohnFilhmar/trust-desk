# What: tests proving that the audit log is append-only, in MySQL and in Ruby.
# Convention: tests for app/models/audit_log.rb go in
#   test/models/audit_log_test.rb.
# Closest equivalent: a Jest test against a real database.
#
# The test database is built from db/structure.sql, which holds the trigger.
# Each test runs inside a transaction that is rolled back at the end. A
# rollback is not a DELETE, so the trigger does not stop it.

require "test_helper"

class AuditLogTest < ActiveSupport::TestCase
  setup do
    @audit_log = AuditLog.create!(
      staff_user: staff_users(:enforcer),
      account: accounts(:active_account),
      action: "account.suspend",
      correlation_id: "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f",
      details: { "previous_status" => "active", "new_status" => "suspended" }
    )
  end

  test "MySQL refuses an UPDATE" do
    # assert_raises returns the exception, so its message can be checked.
    error = assert_raises(ActiveRecord::StatementInvalid) do
      ActiveRecord::Base.connection.execute(
        "UPDATE audit_logs SET action = 'pii.reveal' WHERE id = #{@audit_log.id.to_i}"
      )
    end

    assert_includes error.message, "append-only"
    assert_equal "account.suspend", AuditLog.find(@audit_log.id).action
  end

  test "MySQL refuses a DELETE" do
    error = assert_raises(ActiveRecord::StatementInvalid) do
      ActiveRecord::Base.connection.execute(
        "DELETE FROM audit_logs WHERE id = #{@audit_log.id.to_i}"
      )
    end

    assert_includes error.message, "append-only"
    assert AuditLog.exists?(@audit_log.id)
  end

  test "a saved record cannot be changed from Ruby" do
    @audit_log.action = "pii.reveal"

    assert_raises(ActiveRecord::ReadOnlyRecord) { @audit_log.save! }
    assert_raises(ActiveRecord::ReadOnlyRecord) { @audit_log.update!(action: "mode.change") }
    assert_equal "account.suspend", AuditLog.find(@audit_log.id).action
  end

  test "a saved record cannot be destroyed from Ruby" do
    assert_raises(ActiveRecord::ReadOnlyRecord) { @audit_log.destroy }
    assert AuditLog.exists?(@audit_log.id)
  end

  test "the action must be one of the known ones" do
    audit_log = new_audit_log(action: "account.delete")

    assert_not audit_log.valid?
    assert audit_log.errors.include?(:action)
  end

  test "a mode change needs no account" do
    audit_log = new_audit_log(action: "mode.change", account: nil)

    assert audit_log.valid?
  end

  test "details must be a hash" do
    audit_log = new_audit_log(details: [ "suspended" ])

    assert_not audit_log.valid?
    assert audit_log.errors.include?(:details)
  end

  test "details may not name a PII field" do
    %w[email ip device_fingerprint].each do |key|
      audit_log = new_audit_log(details: { key => "anything" })

      assert_not audit_log.valid?, "#{key} was accepted"
      assert audit_log.errors.include?(:details)
    end
  end

  private

  def new_audit_log(**overrides)
    defaults = {
      staff_user: staff_users(:enforcer),
      account: accounts(:active_account),
      action: "account.suspend",
      correlation_id: "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f",
      details: { "new_status" => "suspended" }
    }
    AuditLog.new(defaults.merge(overrides))
  end
end
