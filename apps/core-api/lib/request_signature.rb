# What: builds the string a signed request covers, signs it, and checks a
#   signature someone sent.
# Convention: config.autoload_lib in config/application.rb makes every file
#   under lib/ loadable by its constant name, so nothing requires this file.
#   The file is request_signature.rb, so Rails expects it to define
#   RequestSignature.
# Closest equivalent: apps/handlers/src/lib/core_api/signing.ts, which is the
#   other half of the same scheme.
#
# The scheme is fixed by packages/shared/fixtures/signing_vectors.json. Both
# test suites read that file, so the two halves cannot drift apart.
#
# This class knows nothing about HTTP or Rails controllers. It takes five
# values and a secret. The controller concern in
# app/controllers/concerns/signed_request.rb reads them from the request.

class RequestSignature
  # How far a timestamp may be from now, in either direction.
  WINDOW_SECONDS = 60

  # Defines a reader method for each name: signature.nonce returns @nonce.
  # The first one is not named `method`, because every Ruby object already
  # has a method of that name.
  attr_reader :http_method, :path, :timestamp, :nonce, :body

  # `http_method:` is a keyword argument. The caller must name it:
  # RequestSignature.new(http_method: "POST", path: "/x", ...).
  def initialize(http_method:, path:, timestamp:, nonce:, body:)
    @http_method = http_method.to_s.upcase
    @path = path.to_s
    @timestamp = timestamp.to_s
    @nonce = nonce.to_s
    @body = body.to_s
  end

  # The five parts joined by a newline, with the body replaced by its
  # SHA-256. Without a separator, the path /a1 followed by 23 and the path
  # /a followed by 123 would produce the same string.
  def canonical
    [ http_method, path, timestamp, nonce, body_sha256 ].join("\n")
  end

  # HMAC-SHA256 of the canonical string, as lowercase hex.
  def sign(secret)
    OpenSSL::HMAC.hexdigest("SHA256", secret, canonical)
  end

  # True when `candidate` is the signature of this request.
  #
  # `==` on strings stops at the first byte that differs, so the time it
  # takes tells an attacker how many leading bytes were right. secure_compare
  # takes the same time wherever the difference is.
  def signed_by?(candidate, secret)
    ActiveSupport::SecurityUtils.secure_compare(sign(secret), candidate.to_s)
  end

  # True when the timestamp is within the window around `now`. `.abs` drops
  # the sign, so a timestamp from the future is treated like one from the past.
  def fresh?(now: Time.current)
    (now.to_i - timestamp.to_i).abs <= WINDOW_SECONDS
  end

  private

  def body_sha256
    OpenSSL::Digest::SHA256.hexdigest(body)
  end
end
