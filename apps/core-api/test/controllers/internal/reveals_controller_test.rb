# What: request tests for POST /internal/reveals.
# Convention: tests for app/controllers/internal/reveals_controller.rb go in
#   test/controllers/internal/reveals_controller_test.rb.
# Closest equivalent: a supertest e2e test in NestJS or Express.

require "test_helper"

module Internal
  class RevealsControllerTest < ActionDispatch::IntegrationTest
    REASON = "Checking whether this signup matches the fraud report."
    PATH = "/internal/reveals"
    FIELDS = %w[email signup_ip device_fingerprint user_agent].freeze

    setup do
      @account = accounts(:active_account)
      @analyst = staff_users(:analyst)
      @body = {
        actor_staff_user_id: @analyst.id,
        account_id: @account.id,
        reason: REASON,
        fields: FIELDS
      }
    end

    test "success answers 201 with the id of the audit row and nothing else" do
      assert_difference "AuditLog.count", 1 do
        signed_post PATH, @body
      end

      assert_response :created
      assert_body_matches_fixture "internal_reveal_result.json"
      assert_equal({ "audit_log_id" => AuditLog.last.id }, response.parsed_body.to_h)
    end

    test "it writes exactly one audit row, which holds field names and no value" do
      correlation_id = "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f"

      assert_difference "AuditLog.count", 1 do
        signed_post PATH, @body, correlation_id: correlation_id
      end

      audit_log = AuditLog.last
      assert_equal "pii.reveal", audit_log.action
      assert_equal @account.id, audit_log.account_id
      assert_equal @analyst.id, audit_log.staff_user_id
      assert_equal correlation_id, audit_log.correlation_id
      assert_equal({ "fields" => FIELDS, "reason" => REASON }, audit_log.details)

      stored = audit_log.details.to_json
      assert_not_includes stored, @account.email
      assert_not_includes stored, @account.signup_context.fetch("ip")
      assert_not_includes stored, @account.signup_context.fetch("device_fingerprint")
      assert_not_includes stored, @account.signup_context.fetch("user_agent")
    end

    test "the response holds no PII, and nothing else is written" do
      assert_no_difference [ "EnforcementAction.count", "IdempotencyKey.count" ] do
        signed_post PATH, @body
      end

      assert_not_includes response.body, @account.email
      assert_not_includes response.body, @account.signup_context.fetch("ip")
      assert_not_includes response.body, @account.signup_context.fetch("device_fingerprint")
      assert Account.find(@account.id).active?
    end

    test "an enforcer may reveal too" do
      signed_post PATH, @body.merge(actor_staff_user_id: staff_users(:enforcer).id)

      assert_response :created
    end

    test "one field is enough, and a field sent twice is stored once" do
      signed_post PATH, @body.merge(fields: %w[email email])

      assert_response :created
      assert_equal [ "email" ], AuditLog.last.details["fields"]
    end

    test "a wrong signature answers 401 and writes nothing" do
      assert_no_difference [ "AuditLog.count", "SignedRequestNonce.count" ] do
        signed_post PATH, @body, secret: "not-the-secret"
      end

      assert_error_envelope :unauthorized, "invalid_signature"
    end

    test "a replayed request answers 401 the second time and writes no second row" do
      nonce = "5f0c1b9e-2a3d-4c6f-8e7a-9b0c1d2e3f40"

      signed_post PATH, @body, nonce: nonce
      assert_response :created

      assert_no_difference "AuditLog.count" do
        signed_post PATH, @body, nonce: nonce
      end
      assert_error_envelope :unauthorized, "replayed_request"
    end

    test "a missing reason and a short reason answer 422 and write nothing" do
      assert_no_difference "AuditLog.count" do
        signed_post PATH, @body.except(:reason)
        assert_error_envelope :unprocessable_content, "invalid_request"

        signed_post PATH, @body.merge(reason: "123456789")
        assert_error_envelope :unprocessable_content, "invalid_request"

        signed_post PATH, @body.merge(reason: "a" * 501)
        assert_error_envelope :unprocessable_content, "invalid_request"
      end
    end

    test "a viewer answers 403 and writes nothing" do
      assert_no_difference "AuditLog.count" do
        signed_post PATH, @body.merge(actor_staff_user_id: staff_users(:viewer).id)
      end

      assert_error_envelope :forbidden, "forbidden"
    end

    test "an unknown staff user answers 403" do
      assert_no_difference "AuditLog.count" do
        signed_post PATH, @body.merge(actor_staff_user_id: 999_999_999)
      end

      assert_error_envelope :forbidden, "forbidden"
    end

    test "an unknown account answers 404 and writes nothing" do
      assert_no_difference "AuditLog.count" do
        signed_post PATH, @body.merge(account_id: 999_999_999)
      end

      assert_error_envelope :not_found, "account_not_found"
    end

    test "a missing account id answers 422" do
      assert_no_difference "AuditLog.count" do
        signed_post PATH, @body.except(:account_id)
      end

      assert_error_envelope :unprocessable_content, "invalid_request"
    end

    test "fields that are missing, empty, not a list or unknown answer 422 and write nothing" do
      bad_fields = [
        nil,
        [],
        "email",
        [ "email", "password_digest" ],
        [ "plan" ],
        [ "email", 3 ],
        [ { name: "email" } ],
        # A value where a name belongs.
        [ "fixture-active@example.com" ]
      ]

      bad_fields.each do |fields|
        assert_no_difference "AuditLog.count" do
          signed_post PATH, @body.merge(fields: fields)
        end

        assert_error_envelope :unprocessable_content, "invalid_request"
      end
    end
  end
end
