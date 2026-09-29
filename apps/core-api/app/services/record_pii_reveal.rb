# What: records that a staff user is about to see the PII of one account.
#   It writes one audit row and nothing else.
# Convention: a service object in app/services/. The file
#   record_pii_reveal.rb must define RecordPiiReveal.
# Closest equivalent: a NestJS provider with one method.
#
# Rails returns no PII and reads none. It takes the id of the account and
# never loads the account, so no email or IP passes through this code. The
# handlers unmask the values only after this service has answered. See
# docs/decisions/005-pii-reveal-audit-writer.md.
#
# The audit row lists the NAMES of the fields that were revealed, never a
# value.

class RecordPiiReveal
  # The fields a reveal can unmask. The same list as revealed_field_schema
  # in packages/shared/src/schemas/reveal.ts.
  FIELDS = %w[email signup_ip device_fingerprint user_agent].freeze

  # Raised when `fields` is not a list, is empty, or names an unknown field.
  class InvalidFields < StandardError; end

  def initialize(account_id:, staff_user:, reason:, fields:, correlation_id:)
    @account_id = account_id
    @staff_user = staff_user
    @reason = reason
    @fields = fields
    @correlation_id = correlation_id
  end

  # Returns the audit row.
  def call
    reason = Reason.clean!(@reason)
    fields = checked_fields

    AuditLog.create!(
      staff_user: @staff_user,
      account_id: @account_id,
      action: "pii.reveal",
      correlation_id: @correlation_id,
      details: { "fields" => fields, "reason" => reason }
    )
  end

  private

  def checked_fields
    raise InvalidFields unless @fields.is_a?(Array) && @fields.any?
    # Array minus array: what is left are the names that are not allowed.
    raise InvalidFields if (@fields - FIELDS).any?

    # uniq drops a name that was sent twice.
    @fields.uniq
  end
end
