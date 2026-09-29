# What: tests for the table of stored answers.
# Convention: tests for app/models/idempotency_key.rb go in
#   test/models/idempotency_key_test.rb.
# Closest equivalent: a Jest test against a real database.

require "test_helper"

class IdempotencyKeyTest < ActiveSupport::TestCase
  KEY = "7d9f0a52-3c1b-4e8a-9f60-2b4c6d8e0a1c"

  test "the unique index refuses a second row with the same key" do
    create_key

    assert_raises(ActiveRecord::RecordNotUnique) { create_key }
    assert_equal 1, IdempotencyKey.where(key: KEY).count
  end

  test "the stored body comes back as it went in" do
    create_key

    stored = IdempotencyKey.find_by!(key: KEY)
    assert_equal({ "audit_log_id" => 7, "account" => { "spam_marked_at" => nil } }, stored.response_body)
    assert_equal 201, stored.response_status
  end

  test "a stored answer cannot be changed or destroyed from Ruby" do
    stored = create_key

    assert_raises(ActiveRecord::ReadOnlyRecord) { stored.update!(response_status: 500) }
    assert_raises(ActiveRecord::ReadOnlyRecord) { stored.destroy }
  end

  private

  def create_key
    IdempotencyKey.create!(
      key: KEY,
      staff_user: staff_users(:enforcer),
      request_path: "POST /internal/accounts/42/suspend",
      request_hash: "a" * 64,
      response_status: 201,
      response_body: { "audit_log_id" => 7, "account" => { "spam_marked_at" => nil } }
    )
  end
end
