# What: tests for the per-request values in app/models/current.rb.
# Convention: tests for app/models/current.rb go in
#   test/models/current_test.rb. This one sends requests, so it inherits
#   from ActionDispatch::IntegrationTest.
# Closest equivalent: a Jest test of an AsyncLocalStorage store.

require "test_helper"

class CurrentTest < ActionDispatch::IntegrationTest
  test "it starts empty and is empty again after a reset" do
    assert_nil Current.correlation_id
    assert_nil Current.staff_user_id

    Current.correlation_id = "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f"
    Current.staff_user_id = 3
    # `reset` is what Rails calls before and after every request.
    Current.reset

    assert_nil Current.correlation_id
    assert_nil Current.staff_user_id
  end

  test "nothing of one request is left for the next" do
    body = { actor_staff_user_id: staff_users(:enforcer).id, reason: "Twelve accounts share this fingerprint." }

    signed_post "/internal/accounts/#{accounts(:active_account).id}/suspend", body
    assert_response :created

    assert_nil Current.correlation_id
    assert_nil Current.staff_user_id
  end

  test "the error log line names the staff user of its own request only" do
    viewer = staff_users(:viewer)
    path = "/internal/accounts/#{accounts(:active_account).id}/suspend"

    first = capture_log do
      signed_post path, { actor_staff_user_id: viewer.id, reason: "Twelve accounts share this fingerprint." }
    end
    second = capture_log do
      signed_post path, { reason: "Twelve accounts share this fingerprint." }, secret: "not-the-secret"
    end

    assert first.any?(/code=forbidden staff_user_id=#{viewer.id}\z/)
    assert second.any?(/code=invalid_signature staff_user_id=none\z/)
  end
end
