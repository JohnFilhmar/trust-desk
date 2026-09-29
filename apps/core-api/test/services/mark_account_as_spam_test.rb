# What: tests for the service that marks an account as spam, without HTTP.
# Convention: tests for app/services/mark_account_as_spam.rb go in
#   test/services/mark_account_as_spam_test.rb.
# Closest equivalent: a Jest test of a NestJS provider against a real database.

require "test_helper"

class MarkAccountAsSpamTest < ActiveSupport::TestCase
  REASON = "Five reports say this site imitates a bank."
  CORRELATION_ID = "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f"
  WRITES = [ "EnforcementAction.count", "AuditLog.count" ].freeze

  # A service whose audit write always fails.
  class FailingAuditMarkAccountAsSpam < MarkAccountAsSpam
    private

    def write_audit_log(_action, _previous_status)
      raise ActiveRecord::StatementInvalid, "the audit write failed"
    end
  end

  test "it sets spam_marked_at, leaves the status alone and writes both rows" do
    account = accounts(:active_account)
    freeze_time

    result = mark(account)

    stored = Account.find(account.id)
    assert stored.active?
    assert_equal Time.current, stored.spam_marked_at
    assert_equal "mark_spam", EnforcementAction.find(result.enforcement_action.id).action_type

    audit_log = AuditLog.find(result.audit_log.id)
    assert_equal "account.mark_spam", audit_log.action
    assert_equal "active", audit_log.details["previous_status"]
    assert_equal "active", audit_log.details["new_status"]
  end

  test "an account already marked is refused and nothing is written" do
    assert_no_difference WRITES do
      assert_raises(MarkAccountAsSpam::AlreadyMarkedSpam) { mark(accounts(:marked_account)) }
    end
  end

  test "the mark is read again under the lock" do
    account = accounts(:active_account)
    # The database says marked. The object in memory still says unmarked.
    Account.where(id: account.id).update_all(spam_marked_at: 1.hour.ago)
    assert_nil account.spam_marked_at

    assert_no_difference WRITES do
      assert_raises(MarkAccountAsSpam::AlreadyMarkedSpam) { mark(account) }
    end
  end

  test "lockdown does not stop it" do
    OperationalMode.create!(mode: "lockdown", reason: "Set by a test.", staff_user: staff_users(:enforcer))

    mark(accounts(:active_account))

    assert_not_nil Account.find(accounts(:active_account).id).spam_marked_at
  end

  test "when the audit row cannot be written, nothing else is kept" do
    account = accounts(:active_account)

    assert_no_difference WRITES do
      assert_raises(ActiveRecord::StatementInvalid) do
        FailingAuditMarkAccountAsSpam.new(
          account: account, staff_user: staff_users(:enforcer),
          reason: REASON, correlation_id: CORRELATION_ID
        ).call
      end
    end

    assert_nil Account.find(account.id).spam_marked_at
  end

  test "the parent class cannot be used by itself" do
    service = AccountEnforcement.new(
      account: accounts(:active_account), staff_user: staff_users(:enforcer),
      reason: REASON, correlation_id: CORRELATION_ID
    )

    assert_no_difference WRITES do
      assert_raises(NotImplementedError) { service.call }
    end
  end

  private

  def mark(account, reason: REASON)
    MarkAccountAsSpam.new(
      account: account, staff_user: staff_users(:enforcer),
      reason: reason, correlation_id: CORRELATION_ID
    ).call
  end
end
