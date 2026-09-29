# What: tests for the nonce store that stops a replayed request.
# Convention: tests for app/models/signed_request_nonce.rb go in
#   test/models/signed_request_nonce_test.rb.
# Closest equivalent: a Jest test against a real database.

require "test_helper"

class SignedRequestNonceTest < ActiveSupport::TestCase
  test "a nonce is accepted once and refused the second time" do
    assert SignedRequestNonce.remember("5f0c1b9e-2a3d-4c6f-8e7a-9b0c1d2e3f40")
    assert_not SignedRequestNonce.remember("5f0c1b9e-2a3d-4c6f-8e7a-9b0c1d2e3f40")
    assert_equal 1, SignedRequestNonce.count
  end

  test "rows older than 120 seconds are deleted and newer ones are kept" do
    now = Time.current
    SignedRequestNonce.remember("old-nonce-000000", now: now - 121)
    SignedRequestNonce.remember("new-nonce-000000", now: now - 119)

    SignedRequestNonce.forget_expired(now: now)

    # pluck reads one column and returns an array of its values.
    assert_equal [ "new-nonce-000000" ], SignedRequestNonce.pluck(:nonce)
  end
end
