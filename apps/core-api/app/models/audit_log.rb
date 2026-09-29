# What: one row of the audit trail. It says who did what, to which account,
#   under which correlation id.
# Convention: a class in app/models/ maps to the table named after it in the
#   plural, here audit_logs.
# Closest equivalent: a TypeORM entity in NestJS, a Django model.
#
# The table is append-only, and three things enforce that:
#   1. a MySQL trigger refuses UPDATE and DELETE, whoever sends them
#   2. the runtime database user holds SELECT and INSERT only
#   3. `readonly?` below stops Ruby code before it sends anything

class AuditLog < ApplicationRecord
  ACTIONS = %w[
    account.suspend account.unsuspend account.mark_spam pii.reveal mode.change
  ].freeze

  # Keys that would hold raw PII. An audit row names an account by its id.
  FORBIDDEN_DETAIL_KEYS = %w[
    email ip signup_ip payload_ip device_fingerprint fingerprint
    signup_fingerprint user_agent password
  ].freeze

  belongs_to :staff_user
  # A mode change concerns no single account, so the account may be missing.
  belongs_to :account, optional: true

  validates :action, presence: true, inclusion: { in: ACTIONS }
  validates :correlation_id, presence: true
  # `validate` with a method name runs that method as a custom validation.
  validate :details_must_be_a_hash
  validate :details_must_not_name_pii_fields

  # Rails asks `readonly?` before every update and destroy, and raises
  # ActiveRecord::ReadOnlyRecord when the answer is true. A new record
  # answers false, so the first save works. A saved record answers true.
  def readonly?
    persisted?
  end

  private

  def details_must_be_a_hash
    errors.add(:details, "must be a hash") unless details.is_a?(Hash)
  end

  # Checks the key names only. The reason an analyst typed is free text and
  # is stored as written.
  def details_must_not_name_pii_fields
    return unless details.is_a?(Hash)

    named = details.keys.map(&:to_s) & FORBIDDEN_DETAIL_KEYS
    errors.add(:details, "must not hold PII") if named.any?
  end
end
