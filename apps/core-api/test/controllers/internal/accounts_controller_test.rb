# What: request tests for POST /internal/accounts/:account_id/suspend.
# Convention: tests for app/controllers/internal/accounts_controller.rb go in
#   test/controllers/internal/. ActionDispatch::IntegrationTest sends each
#   request through the whole stack: routing, the signature check, the
#   controller, the service and MySQL.
# Closest equivalent: a supertest e2e test in NestJS or Express.
#
# signed_post, signed_headers and assert_error_envelope come from
# test/support/signed_request_helper.rb.

require "test_helper"

module Internal
  class AccountsControllerTest < ActionDispatch::IntegrationTest
    REASON = "Twelve accounts share this fingerprint."
    WRITES = [ "EnforcementAction.count", "AuditLog.count" ].freeze
    TIMESTAMP_FORMAT = /\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z\z/

    setup do
      @account = accounts(:active_account)
      @enforcer = staff_users(:enforcer)
      @path = "/internal/accounts/#{@account.id}/suspend"
      @body = { actor_staff_user_id: @enforcer.id, reason: REASON }
    end

    test "success answers 201 and writes the status, one action and one audit row" do
      correlation_id = "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f"

      # Runs the block and checks that each count grew by one.
      assert_difference WRITES, 1 do
        signed_post @path, @body, correlation_id: correlation_id
      end

      assert_response :created
      assert Account.find(@account.id).suspended?

      body = response.parsed_body
      action = EnforcementAction.last
      audit_log = AuditLog.last

      assert_equal action.id, body.dig("enforcement_action", "id")
      assert_equal @account.id, body.dig("enforcement_action", "account_id")
      assert_equal @enforcer.id, body.dig("enforcement_action", "staff_user_id")
      assert_equal "suspend", body.dig("enforcement_action", "action_type")
      assert_equal REASON, body.dig("enforcement_action", "reason")
      assert_equal correlation_id, body.dig("enforcement_action", "correlation_id")
      assert_match TIMESTAMP_FORMAT, body.dig("enforcement_action", "created_at")
      assert_equal({ "id" => @account.id, "status" => "suspended", "spam_marked_at" => nil }, body["account"])
      assert_equal audit_log.id, body["audit_log_id"]

      assert_equal "account.suspend", audit_log.action
      assert_equal correlation_id, audit_log.correlation_id
    end

    test "the success body has the keys and the types of the shared fixture" do
      signed_post @path, @body

      assert_response :created
      assert_equal shape_of(shared_fixture("enforcement_result.json")), shape_of(response.parsed_body.to_h)
    end

    test "the success body holds no PII of the account" do
      signed_post @path, @body

      assert_not_includes response.body, @account.email
      assert_not_includes response.body, @account.signup_context.fetch("ip")
      assert_not_includes response.body, @account.signup_context.fetch("device_fingerprint")
    end

    test "a wrong signature answers 401 and writes nothing" do
      assert_no_difference WRITES + [ "SignedRequestNonce.count" ] do
        signed_post @path, @body, secret: "not-the-secret"
      end

      assert_error_envelope :unauthorized, "invalid_signature"
      assert Account.find(@account.id).active?
    end

    test "a missing signature header answers 401 and writes nothing" do
      headers = signed_headers(path: @path, body: @body.to_json).except("X-Signature")

      assert_no_difference WRITES + [ "SignedRequestNonce.count" ] do
        post @path, params: @body.to_json, headers: headers
      end

      assert_error_envelope :unauthorized, "invalid_signature"
    end

    test "a malformed timestamp or nonce answers 401" do
      raw_body = @body.to_json

      post @path, params: raw_body,
        headers: signed_headers(path: @path, body: raw_body).merge("X-Signature-Timestamp" => "yesterday")
      assert_error_envelope :unauthorized, "invalid_signature"

      post @path, params: raw_body,
        headers: signed_headers(path: @path, body: raw_body).merge("X-Signature-Nonce" => "short")
      assert_error_envelope :unauthorized, "invalid_signature"
    end

    test "a body changed after signing answers 401 and writes nothing" do
      signed_body = @body.to_json
      sent_body = @body.merge(reason: "A different reason, swapped in after signing.").to_json

      assert_no_difference WRITES + [ "SignedRequestNonce.count" ] do
        post @path, params: sent_body, headers: signed_headers(path: @path, body: signed_body)
      end

      assert_error_envelope :unauthorized, "invalid_signature"
      assert Account.find(@account.id).active?
    end

    test "a signature made for another path answers 401" do
      other_path = "/internal/accounts/#{accounts(:suspended_account).id}/suspend"
      raw_body = @body.to_json

      post @path, params: raw_body, headers: signed_headers(path: other_path, body: raw_body)

      assert_error_envelope :unauthorized, "invalid_signature"
    end

    test "a replayed request answers 401 the second time" do
      nonce = "5f0c1b9e-2a3d-4c6f-8e7a-9b0c1d2e3f40"

      signed_post @path, @body, nonce: nonce
      assert_response :created

      assert_no_difference WRITES do
        signed_post @path, @body, nonce: nonce
      end
      assert_error_envelope :unauthorized, "replayed_request"
    end

    test "a nonce is spent even when the first request was refused on its merits" do
      nonce = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
      path = "/internal/accounts/#{accounts(:suspended_account).id}/suspend"

      signed_post path, @body, nonce: nonce
      assert_error_envelope :conflict, "already_suspended"

      signed_post path, @body, nonce: nonce
      assert_error_envelope :unauthorized, "replayed_request"
    end

    test "a timestamp 61 seconds in the past answers 401 and writes nothing" do
      assert_no_difference WRITES + [ "SignedRequestNonce.count" ] do
        signed_post @path, @body, timestamp: Time.current.to_i - 61
      end

      assert_error_envelope :unauthorized, "stale_timestamp"
    end

    test "a timestamp 61 seconds in the future answers 401 and writes nothing" do
      assert_no_difference WRITES + [ "SignedRequestNonce.count" ] do
        signed_post @path, @body, timestamp: Time.current.to_i + 61
      end

      assert_error_envelope :unauthorized, "stale_timestamp"
    end

    test "a timestamp 30 seconds off in either direction is accepted" do
      signed_post @path, @body, timestamp: Time.current.to_i - 30
      assert_response :created

      signed_post "/internal/accounts/#{accounts(:suspended_account).id}/suspend", @body,
        timestamp: Time.current.to_i + 30
      assert_error_envelope :conflict, "already_suspended"
    end

    test "a missing reason answers 422 and writes nothing" do
      assert_no_difference WRITES do
        signed_post @path, { actor_staff_user_id: @enforcer.id }
      end

      assert_error_envelope :unprocessable_content, "invalid_request"
      assert Account.find(@account.id).active?
    end

    test "a reason of 9 characters answers 422 and writes nothing" do
      assert_no_difference WRITES do
        signed_post @path, @body.merge(reason: "123456789")
      end

      assert_error_envelope :unprocessable_content, "invalid_request"
      assert Account.find(@account.id).active?
    end

    test "a blank reason and a reason of 501 characters answer 422" do
      assert_no_difference WRITES do
        signed_post @path, @body.merge(reason: "             ")
        assert_error_envelope :unprocessable_content, "invalid_request"

        signed_post @path, @body.merge(reason: "a" * 501)
        assert_error_envelope :unprocessable_content, "invalid_request"
      end
    end

    test "a reason sent as a list answers 422" do
      assert_no_difference WRITES do
        signed_post @path, @body.merge(reason: [ "Twelve accounts", "share this fingerprint." ])
      end

      assert_error_envelope :unprocessable_content, "invalid_request"
    end

    test "a body that is not JSON answers 422 and writes nothing" do
      assert_no_difference WRITES do
        signed_post @path, "{ this is not JSON"
      end

      assert_error_envelope :unprocessable_content, "invalid_request"
    end

    test "a missing actor answers 422" do
      assert_no_difference WRITES do
        signed_post @path, { reason: REASON }
      end

      assert_error_envelope :unprocessable_content, "invalid_request"
    end

    test "an analyst answers 403 and writes nothing" do
      assert_no_difference WRITES do
        signed_post @path, @body.merge(actor_staff_user_id: staff_users(:analyst).id)
      end

      assert_error_envelope :forbidden, "forbidden"
      assert Account.find(@account.id).active?
    end

    test "a viewer answers 403 and writes nothing" do
      assert_no_difference WRITES do
        signed_post @path, @body.merge(actor_staff_user_id: staff_users(:viewer).id)
      end

      assert_error_envelope :forbidden, "forbidden"
      assert Account.find(@account.id).active?
    end

    test "a group sent by the caller is ignored" do
      assert_no_difference WRITES do
        signed_post @path, @body.merge(actor_staff_user_id: staff_users(:viewer).id, group_name: "enforcer")
      end

      assert_error_envelope :forbidden, "forbidden"
    end

    test "an unknown staff user answers 403" do
      assert_no_difference WRITES do
        signed_post @path, @body.merge(actor_staff_user_id: 999_999_999)
      end

      assert_error_envelope :forbidden, "forbidden"
    end

    test "an account already suspended answers 409 and writes no second action or audit row" do
      signed_post @path, @body
      assert_response :created

      assert_no_difference WRITES do
        signed_post @path, @body
      end

      assert_error_envelope :conflict, "already_suspended"
    end

    test "an unknown account answers 404" do
      assert_no_difference WRITES do
        signed_post "/internal/accounts/999999999/suspend", @body
      end

      assert_error_envelope :not_found, "account_not_found"
    end

    test "a correlation id that is not a UUID is replaced by a new one" do
      signed_post @path, @body, correlation_id: "not-a-uuid; DROP TABLE accounts"

      assert_response :created
      stored = EnforcementAction.last.correlation_id
      assert_match SignedRequestHelper::UUID_FORMAT, stored
      assert_equal stored, AuditLog.last.correlation_id
      assert_equal stored, response.parsed_body.dig("enforcement_action", "correlation_id")
    end

    test "an error carries the correlation id that was sent" do
      correlation_id = "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f"

      signed_post "/internal/accounts/999999999/suspend", @body, correlation_id: correlation_id

      assert_equal correlation_id, response.parsed_body.dig("error", "correlation_id")
    end

    private

    # Replaces every value by the name of its type and keeps the keys, so
    # two bodies can be compared key for key without comparing values.
    def shape_of(value)
      case value
      when Hash
        # to_h with a block builds a new hash from the pairs the block returns.
        value.to_h { |key, inner| [ key.to_s, shape_of(inner) ] }
      when Integer then "integer"
      when String then "string"
      when nil then "null"
      else value.class.name
      end
    end
  end
end
