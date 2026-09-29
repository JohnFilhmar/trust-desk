# What: helpers that sign a request the way the handlers do, and that check
#   the error envelope, so the request tests stay short.
# Convention: Rails has no folder for test helpers. This app uses
#   test/support/. Nothing autoloads it, so test/test_helper.rb requires
#   every file in it and mixes this module into the request tests.
# Closest equivalent: a test utility module imported by Jest tests.

module SignedRequestHelper
  UUID_FORMAT = /\A\h{8}-\h{4}-[1-8]\h{3}-[89ab]\h{3}-\h{12}\z/

  # Builds the headers of a signed request.
  #
  # body      - the exact text that is signed
  # timestamp - Unix seconds. Pass an old or a future one to test the window.
  # nonce     - pass the same one twice to test a replay
  # secret    - pass a different one to test a wrong signature
  def signed_headers(
    path:,
    body:,
    http_method: "POST",
    timestamp: Time.current.to_i,
    nonce: SecureRandom.uuid,
    secret: ENV.fetch("SERVICE_HMAC_SECRET"),
    correlation_id: SecureRandom.uuid
  )
    signature = RequestSignature.new(
      http_method: http_method, path: path, timestamp: timestamp, nonce: nonce, body: body
    ).sign(secret)

    {
      "Content-Type" => "application/json",
      "X-Signature" => signature,
      "X-Signature-Timestamp" => timestamp.to_s,
      "X-Signature-Nonce" => nonce,
      "X-Correlation-Id" => correlation_id
    }
  end

  # Signs a JSON body and sends it. `**options` collects every other keyword
  # argument into a hash, and passes it on to signed_headers.
  def signed_post(path, body, **options)
    # A hash becomes JSON text. A string is sent as it is.
    raw_body = body.is_a?(String) ? body : JSON.generate(body)

    post path, params: raw_body, headers: signed_headers(path: path, body: raw_body, **options)
  end

  # Checks the status, the code, and that the body is the error envelope and
  # nothing else.
  def assert_error_envelope(status, code)
    assert_response status

    body = response.parsed_body
    assert_equal [ "error" ], body.keys
    assert_equal %w[code correlation_id message], body["error"].keys.sort
    assert_equal code, body["error"]["code"]
    assert_match UUID_FORMAT, body["error"]["correlation_id"]
    assert_kind_of String, body["error"]["message"]
    assert_not_empty body["error"]["message"]
  end
end
