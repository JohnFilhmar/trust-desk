# What: marks one account as spam. It sets spam_marked_at and leaves the
#   status alone, so an active account stays active.
# Convention: a service object in app/services/. The file
#   mark_account_as_spam.rb must define MarkAccountAsSpam.
# Closest equivalent: one implementation of an abstract class in TypeScript.
#
# The steps are in the parent, app/services/account_enforcement.rb.
#
# The status does not change, so previous_status and new_status in the
# audit row hold the same value.

class MarkAccountAsSpam < AccountEnforcement
  # Raised when the account is marked by the time the lock is held.
  class AlreadyMarkedSpam < Refused; end

  private

  def action_type
    "mark_spam"
  end

  def audit_action
    "account.mark_spam"
  end

  def check_state!
    # `present?` is false for nil, which is what an unmarked account holds.
    raise AlreadyMarkedSpam if @account.spam_marked_at.present?
  end

  def apply_change
    @account.update!(spam_marked_at: Time.current)
  end
end
