# What: tests for the service that suspends an account, without HTTP.
# Convention: tests for app/services/suspend_account.rb go in
#   test/services/suspend_account_test.rb.
# Closest equivalent: a Jest test of a NestJS provider against a real database.

require "test_helper"

class SuspendAccountTest < ActiveSupport::TestCase
  REASON = "Twelve accounts share this fingerprint."
  CORRELATION_ID = "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f"

  # A service whose audit write always fails. It stands in for a database
  # error halfway through the transaction.
  class FailingAuditSuspendAccount < SuspendAccount
    private

    def write_audit_log(_action, _previous_status)
      raise ActiveRecord::StatementInvalid, "the audit write failed"
    end
  end

  test "it writes the status, the enforcement action and the audit row" do
    account = accounts(:active_account)

    result = suspend(account)

    assert Account.find(account.id).suspended?

    action = EnforcementAction.find(result.enforcement_action.id)
    assert_equal "suspend", action.action_type
    assert_equal REASON, action.reason
    assert_equal account.id, action.account_id
    assert_equal staff_users(:enforcer).id, action.staff_user_id
    assert_equal CORRELATION_ID, action.correlation_id

    audit_log = AuditLog.find(result.audit_log.id)
    assert_equal "account.suspend", audit_log.action
    assert_equal account.id, audit_log.account_id
    assert_equal staff_users(:enforcer).id, audit_log.staff_user_id
    assert_equal CORRELATION_ID, audit_log.correlation_id
    assert_equal(
      {
        "enforcement_action_id" => action.id,
        "action_type" => "suspend",
        "previous_status" => "active",
        "new_status" => "suspended",
        "reason" => REASON
      },
      audit_log.details
    )
  end

  test "the audit row holds no PII of the account" do
    account = accounts(:active_account)

    result = suspend(account)
    stored = AuditLog.find(result.audit_log.id).details.to_json

    assert_not_includes stored, account.email
    assert_not_includes stored, account.signup_context.fetch("ip")
    assert_not_includes stored, account.signup_context.fetch("device_fingerprint")
  end

  test "an account already suspended is refused and nothing is written" do
    assert_no_difference [ "EnforcementAction.count", "AuditLog.count" ] do
      assert_raises(SuspendAccount::AlreadySuspended) { suspend(accounts(:suspended_account)) }
    end
  end

  test "the status is read again under the lock" do
    account = accounts(:active_account)
    # update_all writes to the database and leaves the object in memory as
    # it was, which is what this request would hold if another one had
    # suspended the account a moment ago.
    Account.where(id: account.id).update_all(status: "suspended")
    assert account.active?

    assert_no_difference [ "EnforcementAction.count", "AuditLog.count" ] do
      assert_raises(SuspendAccount::AlreadySuspended) { suspend(account) }
    end
  end

  test "a reason that is missing, too short or too long is refused and nothing is written" do
    [ nil, "", "          ", "a" * 9, "a" * 501 ].each do |reason|
      assert_no_difference [ "EnforcementAction.count", "AuditLog.count" ] do
        assert_raises(SuspendAccount::InvalidReason, "#{reason.inspect} was accepted") do
          suspend(accounts(:active_account), reason: reason)
        end
      end
    end

    assert Account.find(accounts(:active_account).id).active?
  end

  test "when the audit row cannot be written, nothing else is kept" do
    account = accounts(:active_account)

    assert_no_difference [ "EnforcementAction.count", "AuditLog.count" ] do
      assert_raises(ActiveRecord::StatementInvalid) do
        FailingAuditSuspendAccount.new(
          account: account,
          staff_user: staff_users(:enforcer),
          reason: REASON,
          correlation_id: CORRELATION_ID
        ).call
      end
    end

    assert Account.find(account.id).active?
  end

  private

  def suspend(account, reason: REASON)
    SuspendAccount.new(
      account: account,
      staff_user: staff_users(:enforcer),
      reason: reason,
      correlation_id: CORRELATION_ID
    ).call
  end
end
