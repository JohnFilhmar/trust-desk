# What: suspends one account. An active account becomes suspended.
# Convention: a service object in app/services/. The file suspend_account.rb
#   must define SuspendAccount.
# Closest equivalent: one implementation of an abstract class in TypeScript.
#
# The steps are in the parent, app/services/account_enforcement.rb. This
# file holds the four answers that are particular to a suspension.

# `<` means "inherits from".
class SuspendAccount < AccountEnforcement
  # Raised when the account is suspended by the time the lock is held.
  class AlreadySuspended < Refused; end

  private

  def action_type
    "suspend"
  end

  def audit_action
    "account.suspend"
  end

  def check_state!
    raise AlreadySuspended if @account.suspended?
  end

  def apply_change
    @account.update!(status: "suspended")
  end
end
