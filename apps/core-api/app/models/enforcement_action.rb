# What: one action a staff user took against an account, with the reason.
# Convention: a class in app/models/ maps to the table named after it in the
#   plural, here enforcement_actions.
# Closest equivalent: a TypeORM entity in NestJS, a Django model.
#
# The table has created_at and no updated_at. Rails fills in whichever of the
# two columns exist, so nothing here has to say so.

class EnforcementAction < ApplicationRecord
  ACTION_TYPES = %w[suspend unsuspend mark_spam].freeze

  belongs_to :account
  belongs_to :staff_user

  # A callback is a method Rails calls at a fixed point in the life of a
  # record. This one runs before the validations below, so the length is
  # measured on the stripped text.
  before_validation :strip_reason

  validates :action_type, presence: true, inclusion: { in: ACTION_TYPES }
  # The services check the reason first, with the same rule from
  # lib/reason.rb. This is the second check, for code that builds a record
  # without going through a service.
  validates :reason, presence: true, length: { in: Reason::LENGTH }
  validates :correlation_id, presence: true

  # Everything below `private` can be called from inside this class only.
  private

  def strip_reason
    # `self.` is required when assigning. Without it Ruby would create a
    # local variable named reason.
    self.reason = reason.strip if reason.is_a?(String)
  end
end
