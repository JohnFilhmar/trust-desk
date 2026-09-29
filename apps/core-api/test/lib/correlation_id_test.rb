# What: tests for lib/uuid.rb and lib/correlation_id.rb.
# Convention: tests for code in lib/ go in test/lib/.
# Closest equivalent: apps/handlers/src/lib/http/correlation_id.test.ts.

require "test_helper"

class CorrelationIdTest < ActiveSupport::TestCase
  SENT = "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f"

  test "a UUID of version 1 to 8 is valid, in either case" do
    assert Uuid.valid?(SENT)
    assert Uuid.valid?(SENT.upcase)
    assert Uuid.valid?(SecureRandom.uuid)
  end

  test "anything else is not a UUID" do
    bad = [
      nil, "", 42, [ SENT ], "not-a-uuid",
      # One character short.
      SENT.chop,
      # Version 0 and variant c, which zod refuses too.
      "3f2b6c1e-8d4a-0b7e-9c55-0a1b2c3d4e5f",
      "3f2b6c1e-8d4a-4b7e-cc55-0a1b2c3d4e5f",
      # A second line after a valid id.
      "#{SENT}\nforged log line"
    ]

    bad.each { |value| assert_not Uuid.valid?(value), "#{value.inspect} was accepted" }
  end

  test "a valid id that was sent is kept" do
    assert_equal SENT, CorrelationId.resolve(request_with("HTTP_X_CORRELATION_ID" => SENT))
  end

  test "a missing id and a bad id are replaced by a new UUID" do
    [ {}, { "HTTP_X_CORRELATION_ID" => "DROP TABLE accounts" } ].each do |headers|
      id = CorrelationId.resolve(request_with(headers))

      assert Uuid.valid?(id)
    end
  end

  test "the id is picked once, so the log tag and the controller get the same one" do
    # Two request objects over one env, as in a real request: the logger
    # middleware builds one and the controller another.
    env = Rack::MockRequest.env_for("/internal/ping")
    first = CorrelationId.resolve(ActionDispatch::Request.new(env))
    second = CorrelationId.resolve(ActionDispatch::Request.new(env))

    assert_equal first, second
  end

  private

  # Builds a request the way Rack would hand it to Rails.
  def request_with(headers)
    ActionDispatch::Request.new(Rack::MockRequest.env_for("/internal/ping", headers))
  end
end
