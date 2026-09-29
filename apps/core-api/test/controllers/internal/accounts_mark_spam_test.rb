# What: request tests for POST /internal/accounts/:account_id/mark_spam.
# Convention: tests for app/controllers/internal/accounts_controller.rb go in
#   test/controllers/internal/, one file per action.
# Closest equivalent: a supertest e2e test in NestJS or Express.

require "test_helper"

module Internal
  class AccountsMarkSpamTest < ActionDispatch::IntegrationTest
    REASON = "Five reports say this site imitates a bank."
    WRITES = [ "EnforcementAction.count", "AuditLog.count" ].freeze

    setup do
      @account = accounts(:active_account)
      @enforcer = staff_users(:enforcer)
      @path = "/internal/accounts/#{@account.id}/mark_spam"
      @body = { actor_staff_user_id: @enforcer.id, reason: REASON, idempotency_key: nil }
    end

    test "success answers 201, sets spam_marked_at and leaves the status alone" do
      # freeze_time stops the clock for the rest of the test, so "now" in
      # the test is "now" in the code.
      freeze_time

      assert_difference WRITES, 1 do
        signed_post @path, @body
      end

      assert_response :created
      account = Account.find(@account.id)
      assert account.active?
      assert_equal Time.current, account.spam_marked_at

      body = response.parsed_body
      assert_equal "mark_spam", body.dig("enforcement_action", "action_type")
      assert_equal "active", body.dig("account", "status")
      assert_match TIMESTAMP_FORMAT, body.dig("account", "spam_marked_at")
      assert_equal account.spam_marked_at.utc.iso8601(6), body.dig("account", "spam_marked_at")

      audit_log = AuditLog.find(body["audit_log_id"])
      assert_equal "account.mark_spam", audit_log.action
      assert_equal "active", audit_log.details["previous_status"]
      assert_equal "active", audit_log.details["new_status"]
    end

    test "the success body has the keys of the shared fixture, with a time where it has null" do
      signed_post @path, @body

      expected = shape_of(shared_fixture("enforcement_result.json"))
      expected["account"]["spam_marked_at"] = "string"

      assert_equal expected, shape_of(response.parsed_body.to_h)
    end

    test "a suspended account can be marked and stays suspended" do
      account = accounts(:suspended_account)

      signed_post "/internal/accounts/#{account.id}/mark_spam", @body

      assert_response :created
      assert Account.find(account.id).suspended?
      assert_not_nil Account.find(account.id).spam_marked_at
    end

    test "a wrong signature answers 401 and writes nothing" do
      assert_no_difference WRITES + [ "SignedRequestNonce.count" ] do
        signed_post @path, @body, secret: "not-the-secret"
      end

      assert_error_envelope :unauthorized, "invalid_signature"
      assert_nil Account.find(@account.id).spam_marked_at
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

    test "a missing reason answers 422 and writes nothing" do
      assert_no_difference WRITES do
        signed_post @path, @body.except(:reason)
      end

      assert_error_envelope :unprocessable_content, "invalid_request"
      assert_nil Account.find(@account.id).spam_marked_at
    end

    test "an analyst and a viewer answer 403 and write nothing" do
      [ staff_users(:analyst), staff_users(:viewer) ].each do |staff_user|
        assert_no_difference WRITES do
          signed_post @path, @body.merge(actor_staff_user_id: staff_user.id)
        end

        assert_error_envelope :forbidden, "forbidden"
      end

      assert_nil Account.find(@account.id).spam_marked_at
    end

    test "an account already marked answers 409 and keeps its first mark" do
      account = accounts(:marked_account)
      first_mark = account.spam_marked_at

      assert_no_difference WRITES do
        signed_post "/internal/accounts/#{account.id}/mark_spam", @body
      end

      assert_error_envelope :conflict, "already_marked_spam"
      assert_equal first_mark, Account.find(account.id).spam_marked_at
    end

    test "an unknown account answers 404" do
      signed_post "/internal/accounts/999999999/mark_spam", @body

      assert_error_envelope :not_found, "account_not_found"
    end
  end
end
