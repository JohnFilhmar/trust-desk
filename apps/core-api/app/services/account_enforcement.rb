# What: the steps every enforcement action on an account shares. It writes
#   the change to the account, the enforcement action and the audit row
#   together, or none of them.
# Convention: Rails has no folder for service objects. This app uses
#   app/services/, which Rails autoloads like every folder under app/. The
#   file account_enforcement.rb must define AccountEnforcement.
# Closest equivalent: an abstract class in TypeScript with three
#   implementations.
#
# Why a parent class with three children, and not one class that takes a
# rule object: the steps are the same for suspend, unsuspend and mark as
# spam, and only four small answers differ. With inheritance each child is
# a short file that holds those four answers and nothing else, and it reads
# like a row of the rules table. It is also the shape a TypeScript developer
# already knows. The children are:
#
#   SuspendAccount     app/services/suspend_account.rb
#   UnsuspendAccount   app/services/unsuspend_account.rb
#   MarkAccountAsSpam  app/services/mark_account_as_spam.rb
#
# Ruby has no `abstract` keyword. The four methods at the bottom raise here,
# and every child defines them.
#
# The caller has already checked that the staff user may enforce.

class AccountEnforcement
  # The parent of every "this action does not fit the state" error. The
  # controller rescues this one class and looks up the code of the child.
  class Refused < StandardError; end

  # A second name for Reason::Invalid, so a caller can write
  # SuspendAccount::InvalidReason. A constant of the parent class is found
  # through the child.
  InvalidReason = Reason::Invalid

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
    action = build_enforcement_action(Reason.clean!(@reason))

    # with_lock opens a transaction, runs SELECT ... FOR UPDATE on this one
    # row and reloads the record from it. A second request for the same
    # account waits on that line until this block ends. The block's last
    # value is what with_lock returns. An exception raised inside rolls the
    # transaction back.
    @account.with_lock do
      # Checked here and not earlier. Before the lock, the state in memory
      # can be one that another request has just changed.
      check_state!

      previous_status = @account.status

      # A method ending in `!` raises when the record cannot be saved, which
      # rolls the transaction back. The plain form would return false and
      # let the block carry on.
      action.save!
      apply_change
      audit_log = write_audit_log(action, previous_status)

      Result.new(enforcement_action: action, account: @account, audit_log: audit_log)
    end
  end

  private

  def build_enforcement_action(reason)
    EnforcementAction.new(
      account: @account,
      staff_user: @staff_user,
      action_type: action_type,
      reason: reason,
      correlation_id: @correlation_id
    )
  end

  # The details name the account by what happened to it and hold no PII.
  def write_audit_log(action, previous_status)
    AuditLog.create!(
      staff_user: @staff_user,
      account: @account,
      action: audit_action,
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

  # The four answers a child gives.

  # The text stored in enforcement_actions.action_type, such as "suspend".
  def action_type
    raise NotImplementedError, "#{self.class.name} must define action_type"
  end

  # The text stored in audit_logs.action, such as "account.suspend".
  def audit_action
    raise NotImplementedError, "#{self.class.name} must define audit_action"
  end

  # Raises a child of Refused when the action does not fit the account as
  # it is now. It runs while the row lock is held.
  def check_state!
    raise NotImplementedError, "#{self.class.name} must define check_state!"
  end

  # Writes the change to the account.
  def apply_change
    raise NotImplementedError, "#{self.class.name} must define apply_change"
  end
end
