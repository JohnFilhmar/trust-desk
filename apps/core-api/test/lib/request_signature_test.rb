# What: tests for the signing scheme in lib/request_signature.rb.
# Convention: tests for code in lib/ go in test/lib/. ActiveSupport::TestCase
#   is the base class for tests that send no HTTP request.
# Closest equivalent: apps/handlers/src/lib/core_api/signing.test.ts, which
#   reads the same vectors.

require "test_helper"

class RequestSignatureTest < ActiveSupport::TestCase
  # `setup` runs before every test in this class.
  setup do
    @fixture = shared_fixture("signing_vectors.json")
    @secret = @fixture.fetch("secret")
  end

  test "every shared vector gives the expected canonical string and signature" do
    vectors = @fixture.fetch("vectors")
    assert_not_empty vectors

    vectors.each do |vector|
      signature = signature_for(vector)

      # The last argument is the message shown when the assertion fails.
      assert_equal vector.fetch("canonical"), signature.canonical, vector.fetch("name")
      assert_equal vector.fetch("signature"), signature.sign(@secret), vector.fetch("name")
    end
  end

  test "the window in the code is the window in the shared fixture" do
    assert_equal @fixture.dig("scheme", "window_seconds"), RequestSignature::WINDOW_SECONDS
  end

  test "a signature is accepted for the request it was made for, and for no other" do
    vector = @fixture.fetch("vectors").first
    signature = signature_for(vector)
    other_body = signature_for(vector.merge("body" => vector.fetch("body") + " "))

    assert signature.signed_by?(vector.fetch("signature"), @secret)
    assert_not other_body.signed_by?(vector.fetch("signature"), @secret)
    assert_not signature.signed_by?(vector.fetch("signature"), "another-secret")
    assert_not signature.signed_by?("", @secret)
    assert_not signature.signed_by?(nil, @secret)
  end

  test "a lowercase method is signed as uppercase" do
    vector = @fixture.fetch("vectors").first
    signature = signature_for(vector.merge("method" => "post"))

    assert_equal vector.fetch("signature"), signature.sign(@secret)
  end

  test "a timestamp is fresh up to 60 seconds either side of now" do
    now = Time.utc(2026, 9, 30, 12, 0, 0)

    assert timestamped(now.to_i).fresh?(now: now)
    assert timestamped(now.to_i - 60).fresh?(now: now)
    assert timestamped(now.to_i + 60).fresh?(now: now)
    assert_not timestamped(now.to_i - 61).fresh?(now: now)
    assert_not timestamped(now.to_i + 61).fresh?(now: now)
  end

  private

  def signature_for(vector)
    RequestSignature.new(
      http_method: vector.fetch("method"),
      path: vector.fetch("path"),
      timestamp: vector.fetch("timestamp"),
      nonce: vector.fetch("nonce"),
      body: vector.fetch("body")
    )
  end

  def timestamped(timestamp)
    RequestSignature.new(
      http_method: "POST", path: "/internal/ping", timestamp: timestamp, nonce: "n", body: ""
    )
  end
end
