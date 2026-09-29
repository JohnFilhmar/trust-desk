# What: suspends one account. It writes the new status, the enforcement
#   action and the audit row together, or none of them.
# Convention: Rails has no folder for service objects. This app uses
#   app/services/. Rails autoloads every folder directly under app/, so the
#   file suspend_account.rb must define SuspendAccount.
# Closest equivalent: a NestJS provider with one method, a use-case class.
#
# The caller has already checked that the staff user may enforce. This class
# checks the reason and the state of the account.

class SuspendAccount
  # Raised when the reason is missing, too short or too long.
  class InvalidReason < StandardError; end
  # Raised when the account is suspended by the time the lock is held.
  class AlreadySuspended < StandardError; end

  # Data.define builds a small class whose objects cannot be changed after
  # they are created. It has one reader per name.
  Result = Data.define(:enforcement_action, :account, :audit_log)

  def initialize(account:, staff_user:, reason:, correlation_id:)
    @account = account
    @staff_user = staff_user
    @reason = reason
    @correlation_id = correlation_id
  end

  def call
    action = build_enforcement_action
    # `validate` runs the validations and fills `errors` without saving.
    action.validate
    raise InvalidReason if action.errors.include?(:reason)

    # with_lock opens a transaction, runs SELECT ... FOR UPDATE on this one
    # row and reloads the record from it. A second request for the same
    # account waits on that line until this block ends. The block's last
    # value is what with_lock returns. An exception raised inside rolls the
    # transaction back.
    @account.with_lock do
      # Checked here and not earlier. Before the lock, the status in memory
      # can be one that another request has just changed.
      raise AlreadySuspended if @account.suspended?

      previous_status = @account.status

      # A method ending in `!` raises when the record cannot be saved, which
      # rolls the transaction back. The plain form would return false and
      # let the block carry on.
      action.save!
      @account.update!(status: "suspended")
      audit_log = write_audit_log(action, previous_status)

      Result.new(enforcement_action: action, account: @account, audit_log: audit_log)
    end
  end

  private

  def build_enforcement_action
    EnforcementAction.new(
      account: @account,
      staff_user: @staff_user,
      action_type: "suspend",
      reason: @reason,
      correlation_id: @correlation_id
    )
  end

  # The details name the account by what happened to it and hold no PII.
  def write_audit_log(action, previous_status)
    AuditLog.create!(
      staff_user: @staff_user,
      account: @account,
      action: "account.suspend",
      correlation_id: @correlation_id,
      details: {
        "enforcement_action_id" => action.id,
        "action_type" => action.action_type,
        "previous_status" => previous_status,
        "new_status" => @account.status,
        "reason" => action.reason
      }
    )
  end
end
