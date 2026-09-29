# What: tests for what a request writes to the log: the correlation id on
#   every line, and no PII and no secret on any line.
# Convention: a test that is about the whole stack and no single controller
#   goes in test/integration/.
# Closest equivalent: a supertest e2e test that reads a pino destination.
#
# capture_log comes from test/support/log_capture_helper.rb.
#
# Two levels are tested. Production logs at the level info. Development and
# test log at the level debug, which adds the SQL lines. The mysql2 adapter
# writes each value into the SQL text, so at the level debug the reason
# appears in the INSERT that stores it. The tests say which level they read.

require "test_helper"

class RequestLoggingTest < ActionDispatch::IntegrationTest
  REASON = "Twelve accounts share this exact fingerprint."
  CORRELATION_ID = "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f"

  setup do
    @account = accounts(:active_account)
    @path = "/internal/accounts/#{@account.id}/suspend"
    @body = { actor_staff_user_id: staff_users(:enforcer).id, reason: REASON, idempotency_key: nil }
  end

  test "every log line of a request carries the correlation id, SQL lines included" do
    lines = capture_log(level: Logger::DEBUG) do
      signed_post @path, @body, correlation_id: CORRELATION_ID
    end

    assert_response :created
    # any? with a pattern is true when at least one line matches it.
    assert lines.any?(/Started POST/), "Rails' own Started line is missing"
    assert lines.any?(/Completed 201/), "Rails' own Completed line is missing"
    assert lines.any?(/Enforcement action written/), "the line of the controller is missing"
    assert lines.any?(/INSERT INTO `audit_logs`/), "the SQL lines are missing"

    lines.each do |line|
      assert_includes line, "[correlation_id=#{CORRELATION_ID}]"
    end
  end

  test "a refused request carries the correlation id on every line too" do
    lines = capture_log(level: Logger::DEBUG) do
      signed_post @path, @body, correlation_id: CORRELATION_ID, secret: "not-the-secret"
    end

    assert_error_envelope :unauthorized, "invalid_signature"
    assert lines.any?(/Answered with an error. code=invalid_signature/)
    lines.each { |line| assert_includes line, "[correlation_id=#{CORRELATION_ID}]" }
  end

  test "an id that is not a UUID never reaches the log, and one new id tags every line" do
    lines = capture_log(level: Logger::DEBUG) do
      signed_post @path, @body, correlation_id: "forged] [correlation_id=not-mine"
    end

    assert_response :created
    used = response.parsed_body.dig("enforcement_action", "correlation_id")
    assert_match UUID_FORMAT, used
    lines.each do |line|
      assert_includes line, "[correlation_id=#{used}]"
      assert_not_includes line, "not-mine"
    end
  end

  test "at the level production logs at, a suspend writes no reason and no PII" do
    lines = capture_log(level: Logger::INFO) do
      signed_post @path, @body, correlation_id: CORRELATION_ID
    end

    assert_response :created
    assert lines.any?(/Enforcement action written/)
    log = lines.join("\n")

    assert_not_includes log, REASON
    assert_no_pii_or_secret_in(log)
    # The ids are what the log is for.
    assert_includes log, "account_id=#{@account.id}"
    assert_includes log, "staff_user_id=#{staff_users(:enforcer).id}"
  end

  test "at the level debug, the account's PII and the secrets still stay out" do
    lines = capture_log(level: Logger::DEBUG) do
      signed_post @path, @body, correlation_id: CORRELATION_ID
    end

    assert_response :created
    assert_no_pii_or_secret_in(lines.join("\n"))
  end

  test "the parameters line hides the reason" do
    lines = capture_log(level: Logger::DEBUG) do
      signed_post @path, @body, correlation_id: CORRELATION_ID
    end

    parameters = lines.find { |line| line.include?("Parameters:") }

    assert_not_nil parameters
    assert_includes parameters, "[FILTERED]"
    assert_not_includes parameters, REASON
  end

  test "a reveal logs the ids and none of the account's PII" do
    body = {
      actor_staff_user_id: staff_users(:analyst).id,
      account_id: @account.id,
      reason: REASON,
      fields: %w[email signup_ip device_fingerprint user_agent]
    }

    lines = capture_log(level: Logger::DEBUG) do
      signed_post "/internal/reveals", body, correlation_id: CORRELATION_ID
    end

    assert_response :created
    assert lines.any?(/PII reveal recorded. account_id=#{@account.id}/)
    assert_no_pii_or_secret_in(lines.join("\n"))
    # No query of a reveal reads the columns of the account.
    assert lines.none?(/SELECT `accounts`\.\*/)
  end

  test "the filter list covers the names the brief asks for" do
    filter = ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters)
    filtered = filter.filter(
      "password" => "x", "password_digest" => "x", "email" => "x", "ip" => "x",
      "signup_ip" => "x", "device_fingerprint" => "x", "user_agent" => "x",
      "reason" => "x", "signature" => "x", "nonce" => "x",
      "actor_staff_user_id" => 3, "account_id" => 42, "description" => "kept"
    )

    hidden = %w[password password_digest email ip signup_ip device_fingerprint user_agent reason signature nonce]
    hidden.each { |name| assert_equal "[FILTERED]", filtered[name], name }
    assert_equal 3, filtered["actor_staff_user_id"]
    assert_equal 42, filtered["account_id"]
    assert_equal "kept", filtered["description"]
  end

  private

  def assert_no_pii_or_secret_in(log)
    assert_not_includes log, @account.email
    assert_not_includes log, @account.signup_context.fetch("ip")
    assert_not_includes log, @account.signup_context.fetch("device_fingerprint")
    assert_not_includes log, @account.signup_context.fetch("user_agent")
    assert_not_includes log, ENV.fetch("SERVICE_HMAC_SECRET")
    assert_not_includes log, request.headers["X-Signature"]
    assert_not_includes log, staff_users(:enforcer).email
  end
end
