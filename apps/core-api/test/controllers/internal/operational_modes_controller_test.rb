# What: request tests for POST /internal/operational_modes.
# Convention: tests for
#   app/controllers/internal/operational_modes_controller.rb go in
#   test/controllers/internal/operational_modes_controller_test.rb.
# Closest equivalent: a supertest e2e test in NestJS or Express.

require "test_helper"

module Internal
  class OperationalModesControllerTest < ActionDispatch::IntegrationTest
    REASON = "Signup burst from one network in the last hour."
    PATH = "/internal/operational_modes"
    WRITES = [ "OperationalMode.count", "AuditLog.count" ].freeze

    setup do
      @enforcer = staff_users(:enforcer)
      @body = { actor_staff_user_id: @enforcer.id, mode: "elevated", reason: REASON }
    end

    test "success answers 201 and writes the mode and the audit row" do
      correlation_id = "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f"

      assert_difference WRITES, 1 do
        signed_post PATH, @body, correlation_id: correlation_id
      end

      assert_response :created
      assert_body_matches_fixture "internal_mode_change_result.json"
      assert_equal "elevated", OperationalMode.current

      body = response.parsed_body
      mode = OperationalMode.last
      audit_log = AuditLog.last

      assert_equal mode.id, body.dig("operational_mode", "id")
      assert_equal "elevated", body.dig("operational_mode", "mode")
      assert_equal REASON, body.dig("operational_mode", "reason")
      assert_equal @enforcer.id, body.dig("operational_mode", "staff_user_id")
      assert_match TIMESTAMP_FORMAT, body.dig("operational_mode", "created_at")
      assert_equal audit_log.id, body["audit_log_id"]

      assert_equal "mode.change", audit_log.action
      assert_nil audit_log.account_id
      assert_equal @enforcer.id, audit_log.staff_user_id
      assert_equal correlation_id, audit_log.correlation_id
      assert_equal(
        { "previous_mode" => "normal", "new_mode" => "elevated", "reason" => REASON },
        audit_log.details
      )
    end

    test "each change records the mode before it" do
      signed_post PATH, @body.merge(mode: "lockdown")
      assert_response :created
      signed_post PATH, @body.merge(mode: "normal")
      assert_response :created

      assert_equal "normal", OperationalMode.current
      assert_equal "lockdown", AuditLog.last.details["previous_mode"]
      assert_equal "normal", AuditLog.last.details["new_mode"]
    end

    test "the reason is stored without the spaces around it" do
      signed_post PATH, @body.merge(reason: "   #{REASON}   ")

      assert_response :created
      assert_equal REASON, OperationalMode.last.reason
    end

    test "a wrong signature answers 401 and writes nothing" do
      assert_no_difference WRITES + [ "SignedRequestNonce.count" ] do
        signed_post PATH, @body, secret: "not-the-secret"
      end

      assert_error_envelope :unauthorized, "invalid_signature"
      assert_equal "normal", OperationalMode.current
    end

    test "a replayed request answers 401 the second time" do
      nonce = "5f0c1b9e-2a3d-4c6f-8e7a-9b0c1d2e3f40"

      signed_post PATH, @body, nonce: nonce
      assert_response :created

      assert_no_difference WRITES do
        signed_post PATH, @body, nonce: nonce
      end
      assert_error_envelope :unauthorized, "replayed_request"
    end

    test "a missing reason and a short reason answer 422 and write nothing" do
      assert_no_difference WRITES do
        signed_post PATH, @body.except(:reason)
        assert_error_envelope :unprocessable_content, "invalid_request"

        signed_post PATH, @body.merge(reason: "123456789")
        assert_error_envelope :unprocessable_content, "invalid_request"
      end

      assert_equal "normal", OperationalMode.current
    end

    test "a mode that is missing or unknown answers 422 and writes nothing" do
      assert_no_difference WRITES do
        signed_post PATH, @body.except(:mode)
        assert_error_envelope :unprocessable_content, "invalid_request"

        signed_post PATH, @body.merge(mode: "panic")
        assert_error_envelope :unprocessable_content, "invalid_request"

        signed_post PATH, @body.merge(mode: [ "elevated" ])
        assert_error_envelope :unprocessable_content, "invalid_request"
      end
    end

    test "an analyst and a viewer answer 403 and write nothing" do
      [ staff_users(:analyst), staff_users(:viewer) ].each do |staff_user|
        assert_no_difference WRITES do
          signed_post PATH, @body.merge(actor_staff_user_id: staff_user.id)
        end

        assert_error_envelope :forbidden, "forbidden"
      end

      assert_equal "normal", OperationalMode.current
    end

    test "the mode already in force answers 409 and writes nothing" do
      signed_post PATH, @body
      assert_response :created

      assert_no_difference WRITES do
        signed_post PATH, @body.merge(reason: "Asking for elevated a second time.")
      end

      assert_error_envelope :conflict, "mode_unchanged"
    end

    test "normal on an empty table answers 409, because normal is the default" do
      assert_no_difference WRITES do
        signed_post PATH, @body.merge(mode: "normal")
      end

      assert_error_envelope :conflict, "mode_unchanged"
    end

    test "the advisory lock is given back after a success and after a refusal" do
      signed_post PATH, @body
      assert_response :created
      assert_lock_is_free

      signed_post PATH, @body
      assert_error_envelope :conflict, "mode_unchanged"
      assert_lock_is_free
    end

    private

    # IS_FREE_LOCK answers 1 when no connection holds the lock.
    def assert_lock_is_free
      free = ActiveRecord::Base.connection.select_value(
        "SELECT IS_FREE_LOCK('trust_desk_operational_mode')"
      )

      assert_equal 1, free
    end
  end
end
