# What: tests for the service that lifts a suspension, without HTTP.
# Convention: tests for app/services/unsuspend_account.rb go in
#   test/services/unsuspend_account_test.rb.
# Closest equivalent: a Jest test of a NestJS provider against a real database.

require "test_helper"

class UnsuspendAccountTest < ActiveSupport::TestCase
  REASON = "The owner proved the account is theirs."
  CORRELATION_ID = "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f"
  WRITES = [ "EnforcementAction.count", "AuditLog.count" ].freeze

  # A service whose audit write always fails.
  class FailingAuditUnsuspendAccount < UnsuspendAccount
    private

    def write_audit_log(_action, _previous_status)
      raise ActiveRecord::StatementInvalid, "the audit write failed"
    end
  end

  test "it writes the status, the enforcement action and the audit row" do
    account = accounts(:suspended_account)

    result = unsuspend(account)

    assert Account.find(account.id).active?
    assert_equal "unsuspend", EnforcementAction.find(result.enforcement_action.id).action_type

    audit_log = AuditLog.find(result.audit_log.id)
    assert_equal "account.unsuspend", audit_log.action
    assert_equal(
      {
        "enforcement_action_id" => result.enforcement_action.id,
        "action_type" => "unsuspend",
        "previous_status" => "suspended",
        "new_status" => "active",
        "reason" => REASON
      },
      audit_log.details
    )
  end

  test "an active account is refused and nothing is written" do
    assert_no_difference WRITES do
      assert_raises(UnsuspendAccount::NotSuspended) { unsuspend(accounts(:active_account)) }
    end
  end

  test "the status is read again under the lock" do
    account = accounts(:suspended_account)
    # The database says active. The object in memory still says suspended.
    Account.where(id: account.id).update_all(status: "active")
    assert account.suspended?

    assert_no_difference WRITES do
      assert_raises(UnsuspendAccount::NotSuspended) { unsuspend(account) }
    end
  end

  test "lockdown refuses it and nothing is written" do
    account = accounts(:suspended_account)
    set_mode("lockdown")

    assert_no_difference WRITES do
      assert_raises(UnsuspendAccount::BlockedByLockdown) { unsuspend(account) }
    end

    assert Account.find(account.id).suspended?
  end

  test "the newest mode decides, so a lockdown that has ended refuses nothing" do
    set_mode("lockdown", created_at: 2.hours.ago)
    set_mode("normal", created_at: 1.hour.ago)

    unsuspend(accounts(:suspended_account))

    assert Account.find(accounts(:suspended_account).id).active?
  end

  test "a refusal is an AccountEnforcement::Refused, which the controller rescues" do
    assert_operator UnsuspendAccount::NotSuspended, :<, AccountEnforcement::Refused
    assert_operator UnsuspendAccount::BlockedByLockdown, :<, AccountEnforcement::Refused
  end

  test "a bad reason is refused before anything is written" do
    assert_no_difference WRITES do
      assert_raises(Reason::Invalid) { unsuspend(accounts(:suspended_account), reason: "too short") }
    end
  end

  test "when the audit row cannot be written, nothing else is kept" do
    account = accounts(:suspended_account)

    assert_no_difference WRITES do
      assert_raises(ActiveRecord::StatementInvalid) do
        FailingAuditUnsuspendAccount.new(
          account: account, staff_user: staff_users(:enforcer),
          reason: REASON, correlation_id: CORRELATION_ID
        ).call
      end
    end

    assert Account.find(account.id).suspended?
  end

  private

  def unsuspend(account, reason: REASON)
    UnsuspendAccount.new(
      account: account, staff_user: staff_users(:enforcer),
      reason: reason, correlation_id: CORRELATION_ID
    ).call
  end

  def set_mode(mode, created_at: Time.current)
    OperationalMode.create!(
      mode: mode, reason: "Set by a test.", staff_user: staff_users(:enforcer), created_at: created_at
    )
  end
end
