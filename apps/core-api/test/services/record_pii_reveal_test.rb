# What: tests for the service that records a PII reveal, without HTTP.
# Convention: tests for app/services/record_pii_reveal.rb go in
#   test/services/record_pii_reveal_test.rb.
# Closest equivalent: a Jest test of a NestJS provider against a real database.

require "test_helper"

class RecordPiiRevealTest < ActiveSupport::TestCase
  REASON = "Checking whether this signup matches the fraud report."
  CORRELATION_ID = "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f"

  test "it writes one audit row with the field names and the reason" do
    audit_log = nil

    assert_difference "AuditLog.count", 1 do
      audit_log = reveal(fields: %w[email signup_ip])
    end

    assert_equal "pii.reveal", audit_log.action
    assert_equal accounts(:active_account).id, audit_log.account_id
    assert_equal staff_users(:analyst).id, audit_log.staff_user_id
    assert_equal CORRELATION_ID, audit_log.correlation_id
    assert_equal({ "fields" => %w[email signup_ip], "reason" => REASON }, audit_log.details)
  end

  test "the list of fields equals the one in the shared schema" do
    assert_equal %w[email signup_ip device_fingerprint user_agent], RecordPiiReveal::FIELDS
  end

  test "fields that are empty, not a list or unknown are refused" do
    [ nil, [], "email", [ "plan" ], [ "email", "plan" ], [ 3 ] ].each do |fields|
      assert_no_difference "AuditLog.count" do
        assert_raises(RecordPiiReveal::InvalidFields, "#{fields.inspect} was accepted") do
          reveal(fields: fields)
        end
      end
    end
  end

  test "a bad reason is refused" do
    assert_no_difference "AuditLog.count" do
      assert_raises(Reason::Invalid) { reveal(reason: "too short") }
      assert_raises(Reason::Invalid) { reveal(reason: nil) }
    end
  end

  private

  def reveal(fields: %w[email], reason: REASON)
    RecordPiiReveal.new(
      account_id: accounts(:active_account).id,
      staff_user: staff_users(:analyst),
      reason: reason,
      fields: fields,
      correlation_id: CORRELATION_ID
    ).call
  end
end
