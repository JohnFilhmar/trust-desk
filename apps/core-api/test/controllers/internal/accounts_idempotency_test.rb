# What: request tests for the idempotency key on suspend, unsuspend and mark
#   as spam.
# Convention: tests for app/controllers/internal/accounts_controller.rb go in
#   test/controllers/internal/.
# Closest equivalent: a supertest e2e test of an idempotency interceptor.
#
# Every request here is signed anew, with a new nonce, unless a test says
# otherwise. That is what a retry from the handlers looks like.

require "test_helper"

module Internal
  class AccountsIdempotencyTest < ActionDispatch::IntegrationTest
    REASON = "Twelve accounts share this fingerprint."
    KEY = "7d9f0a52-3c1b-4e8a-9f60-2b4c6d8e0a1c"
    ALL_WRITES = [ "EnforcementAction.count", "AuditLog.count", "IdempotencyKey.count" ].freeze

    setup do
      @account = accounts(:active_account)
      @enforcer = staff_users(:enforcer)
      @path = "/internal/accounts/#{@account.id}/suspend"
      @body = { actor_staff_user_id: @enforcer.id, reason: REASON, idempotency_key: KEY }
    end

    test "the first request with a key runs the action and stores the answer" do
      assert_difference ALL_WRITES, 1 do
        signed_post @path, @body
      end

      assert_response :created
      stored = IdempotencyKey.find_by!(key: KEY)
      assert_equal @enforcer.id, stored.staff_user_id
      assert_equal "POST #{@path}", stored.request_path
      assert_match(/\A[0-9a-f]{64}\z/, stored.request_hash)
      assert_equal 201, stored.response_status
      assert_equal response.parsed_body.to_h, stored.response_body
    end

    test "a repeated key returns the stored answer and writes nothing new" do
      signed_post @path, @body
      assert_response :created
      first_body = response.parsed_body.to_h

      assert_no_difference ALL_WRITES do
        signed_post @path, @body
      end

      assert_response :created
      assert_equal first_body, response.parsed_body.to_h
      assert Account.find(@account.id).suspended?
    end

    test "the order of the keys in the body does not matter" do
      signed_post @path, @body
      assert_response :created
      first_body = response.parsed_body.to_h

      reordered = { idempotency_key: KEY, reason: REASON, actor_staff_user_id: @enforcer.id }
      assert_no_difference ALL_WRITES do
        signed_post @path, reordered
      end

      assert_response :created
      assert_equal first_body, response.parsed_body.to_h
    end

    test "a reused key with a different reason answers 422" do
      signed_post @path, @body
      assert_response :created

      assert_no_difference ALL_WRITES do
        signed_post @path, @body.merge(reason: "A different reason for the same key.")
      end

      assert_error_envelope :unprocessable_content, "idempotency_key_reused"
    end

    test "a reused key on a different path answers 422 and changes nothing" do
      signed_post @path, @body
      assert_response :created

      other = accounts(:marked_account)
      assert_no_difference ALL_WRITES do
        signed_post "/internal/accounts/#{other.id}/suspend", @body
      end

      assert_error_envelope :unprocessable_content, "idempotency_key_reused"
      assert Account.find(other.id).active?
    end

    test "a key stored for suspend cannot be used for unsuspend" do
      signed_post @path, @body
      assert_response :created

      assert_no_difference ALL_WRITES do
        signed_post "/internal/accounts/#{@account.id}/unsuspend", @body
      end

      assert_error_envelope :unprocessable_content, "idempotency_key_reused"
      assert Account.find(@account.id).suspended?
    end

    test "a viewer who sends a stored key answers 403 and gets no stored answer" do
      signed_post @path, @body
      assert_response :created

      assert_no_difference ALL_WRITES do
        signed_post @path, @body.merge(actor_staff_user_id: staff_users(:viewer).id)
      end

      assert_error_envelope :forbidden, "forbidden"
    end

    test "a stored key sent by another enforcer answers 422" do
      other_enforcer = StaffUser.create!(
        email: "second-enforcer@example.com", display_name: "Second Enforcer",
        group_name: "enforcer", password: "a-long-test-password"
      )
      signed_post @path, @body
      assert_response :created

      assert_no_difference ALL_WRITES do
        signed_post @path, @body.merge(actor_staff_user_id: other_enforcer.id)
      end

      assert_error_envelope :unprocessable_content, "idempotency_key_reused"
    end

    test "a refusal is not stored, so the same key works once the state is fixed" do
      account = accounts(:suspended_account)
      path = "/internal/accounts/#{account.id}/suspend"

      assert_no_difference ALL_WRITES do
        signed_post path, @body
      end
      assert_error_envelope :conflict, "already_suspended"

      # Someone lifts the suspension. Now the first request makes sense.
      signed_post "/internal/accounts/#{account.id}/unsuspend",
        @body.merge(idempotency_key: nil, reason: "Lifted so the test can suspend again.")
      assert_response :created

      assert_difference ALL_WRITES, 1 do
        signed_post path, @body
      end
      assert_response :created
      assert Account.find(account.id).suspended?
    end

    test "a bad reason is not stored either" do
      assert_no_difference ALL_WRITES do
        signed_post @path, @body.merge(reason: "too short")
      end
      assert_error_envelope :unprocessable_content, "invalid_request"

      assert_difference ALL_WRITES, 1 do
        signed_post @path, @body
      end
      assert_response :created
    end

    test "the two layers: the same signed request is refused, the same key in a new one is answered" do
      nonce = "5f0c1b9e-2a3d-4c6f-8e7a-9b0c1d2e3f40"
      timestamp = Time.current.to_i

      signed_post @path, @body, nonce: nonce, timestamp: timestamp
      assert_response :created
      first_body = response.parsed_body.to_h

      # Layer one. A copy of the very same signed request: same nonce, same
      # timestamp, same signature. The nonce check refuses it before the
      # idempotency key is looked at.
      assert_no_difference ALL_WRITES do
        signed_post @path, @body, nonce: nonce, timestamp: timestamp
      end
      assert_error_envelope :unauthorized, "replayed_request"

      # Layer two. The same body in a request that was signed anew. The
      # nonce is new, so the signature check passes, and the idempotency
      # key finds the stored answer.
      assert_no_difference ALL_WRITES do
        signed_post @path, @body
      end
      assert_response :created
      assert_equal first_body, response.parsed_body.to_h
    end

    test "a key that is not a UUID answers 422 and writes nothing" do
      [ "not-a-uuid", "", 12_345, [ KEY ], { key: KEY } ].each do |bad_key|
        assert_no_difference ALL_WRITES do
          signed_post @path, @body.merge(idempotency_key: bad_key)
        end

        assert_error_envelope :unprocessable_content, "invalid_request"
      end

      assert Account.find(@account.id).active?
    end

    test "a null key and an absent key run the action and store nothing" do
      assert_no_difference "IdempotencyKey.count" do
        signed_post @path, @body.merge(idempotency_key: nil)
        assert_response :created

        signed_post "/internal/accounts/#{accounts(:marked_account).id}/suspend", @body.except(:idempotency_key)
        assert_response :created
      end
    end

    test "without a key a second suspend is refused on its merits" do
      body = @body.merge(idempotency_key: nil)

      signed_post @path, body
      assert_response :created

      signed_post @path, body
      assert_error_envelope :conflict, "already_suspended"
    end

    test "unsuspend and mark as spam store and repeat their answers too" do
      unsuspend_path = "/internal/accounts/#{accounts(:suspended_account).id}/unsuspend"
      mark_path = "/internal/accounts/#{@account.id}/mark_spam"
      unsuspend_body = @body.merge(idempotency_key: "11111111-2222-4333-8444-555555555555")
      mark_body = @body.merge(idempotency_key: "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a")

      [ [ unsuspend_path, unsuspend_body ], [ mark_path, mark_body ] ].each do |path, body|
        assert_difference ALL_WRITES, 1 do
          signed_post path, body
        end
        assert_response :created
        first_body = response.parsed_body.to_h

        assert_no_difference ALL_WRITES do
          signed_post path, body
        end
        assert_response :created
        assert_equal first_body, response.parsed_body.to_h
      end
    end
  end
end
