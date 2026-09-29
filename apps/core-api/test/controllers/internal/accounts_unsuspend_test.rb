# What: request tests for POST /internal/accounts/:account_id/unsuspend.
# Convention: tests for app/controllers/internal/accounts_controller.rb go in
#   test/controllers/internal/. The controller has three actions, and each
#   has a test file of its own so none grows too long.
# Closest equivalent: a supertest e2e test in NestJS or Express.

require "test_helper"

module Internal
  class AccountsUnsuspendTest < ActionDispatch::IntegrationTest
    REASON = "The owner proved the account is theirs."
    WRITES = [ "EnforcementAction.count", "AuditLog.count" ].freeze

    setup do
      @account = accounts(:suspended_account)
      @enforcer = staff_users(:enforcer)
      @path = "/internal/accounts/#{@account.id}/unsuspend"
      @body = { actor_staff_user_id: @enforcer.id, reason: REASON, idempotency_key: nil }
    end

    test "success answers 201 and writes the status, one action and one audit row" do
      assert_difference WRITES, 1 do
        signed_post @path, @body
      end

      assert_response :created
      assert_body_matches_fixture "enforcement_result.json"
      assert Account.find(@account.id).active?

      body = response.parsed_body
      assert_equal "unsuspend", body.dig("enforcement_action", "action_type")
      assert_equal REASON, body.dig("enforcement_action", "reason")
      assert_equal({ "id" => @account.id, "status" => "active", "spam_marked_at" => nil }, body["account"])

      audit_log = AuditLog.find(body["audit_log_id"])
      assert_equal "account.unsuspend", audit_log.action
      assert_equal "suspended", audit_log.details["previous_status"]
      assert_equal "active", audit_log.details["new_status"]
    end

    test "a wrong signature answers 401 and writes nothing" do
      assert_no_difference WRITES + [ "SignedRequestNonce.count" ] do
        signed_post @path, @body, secret: "not-the-secret"
      end

      assert_error_envelope :unauthorized, "invalid_signature"
      assert Account.find(@account.id).suspended?
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
      assert Account.find(@account.id).suspended?
    end

    test "a reason of 9 characters answers 422 and writes nothing" do
      assert_no_difference WRITES do
        signed_post @path, @body.merge(reason: "123456789")
      end

      assert_error_envelope :unprocessable_content, "invalid_request"
    end

    test "an analyst and a viewer answer 403 and write nothing" do
      [ staff_users(:analyst), staff_users(:viewer) ].each do |staff_user|
        assert_no_difference WRITES do
          signed_post @path, @body.merge(actor_staff_user_id: staff_user.id)
        end

        assert_error_envelope :forbidden, "forbidden"
      end

      assert Account.find(@account.id).suspended?
    end

    test "an active account answers 409 not_suspended and writes nothing" do
      assert_no_difference WRITES do
        signed_post "/internal/accounts/#{accounts(:active_account).id}/unsuspend", @body
      end

      assert_error_envelope :conflict, "not_suspended"
      assert Account.find(accounts(:active_account).id).active?
    end

    test "in lockdown it answers 409 blocked_by_lockdown and changes nothing" do
      set_mode("lockdown")

      assert_no_difference WRITES do
        signed_post @path, @body
      end

      assert_error_envelope :conflict, "blocked_by_lockdown"
      assert Account.find(@account.id).suspended?
    end

    test "in elevated mode, and after a lockdown has ended, it works" do
      set_mode("lockdown", created_at: 2.hours.ago)
      set_mode("elevated", created_at: 1.hour.ago)

      signed_post @path, @body

      assert_response :created
      assert Account.find(@account.id).active?
    end

    test "lockdown does not stop a suspension" do
      set_mode("lockdown")

      signed_post "/internal/accounts/#{accounts(:active_account).id}/suspend", @body

      assert_response :created
    end

    test "an unknown account answers 404" do
      signed_post "/internal/accounts/999999999/unsuspend", @body

      assert_error_envelope :not_found, "account_not_found"
    end

    private

    def set_mode(mode, created_at: Time.current)
      OperationalMode.create!(
        mode: mode, reason: "Set by a test.", staff_user: @enforcer, created_at: created_at
      )
    end
  end
end
