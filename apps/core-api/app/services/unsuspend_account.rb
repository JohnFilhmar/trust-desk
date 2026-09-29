# What: lifts the suspension of one account. A suspended account becomes
#   active, unless the operational mode is lockdown.
# Convention: a service object in app/services/. The file
#   unsuspend_account.rb must define UnsuspendAccount.
# Closest equivalent: one implementation of an abstract class in TypeScript.
#
# The steps are in the parent, app/services/account_enforcement.rb.
#
# This is the one place that enforces lockdown. The console hides the
# button in lockdown, but a request that arrives anyway is refused here.

class UnsuspendAccount < AccountEnforcement
  # Raised when the account is not suspended by the time the lock is held.
  class NotSuspended < Refused; end
  # Raised when the operational mode is lockdown.
  class BlockedByLockdown < Refused; end

  private

  def action_type
    "unsuspend"
  end

  def audit_action
    "account.unsuspend"
  end

  # The mode is read here, while the row lock is held and just before the
  # change is written, so a lockdown that was set a moment ago is respected.
  def check_state!
    raise NotSuspended unless @account.suspended?
    raise BlockedByLockdown if OperationalMode.current == "lockdown"
  end

  def apply_change
    @account.update!(status: "active")
  end
end
