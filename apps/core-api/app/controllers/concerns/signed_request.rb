# What: checks the HMAC signature of every request to an internal
#   controller, and refuses a request that was already seen.
# Convention: a concern is a module kept in app/controllers/concerns/ and
#   mixed into a controller with `include`. Rails autoloads the folder, so
#   the file signed_request.rb must define SignedRequest.
# Closest equivalent: a guard in NestJS, a middleware in Express that is
#   mounted on one router only.
#
# The order of the checks matters. The signature is checked before the nonce
# is stored, so a caller without the secret cannot fill the nonce table.
#
# The controller that includes this module must provide `render_error`.
# Internal::BaseController does.

module SignedRequest
  # Gives the module the `included` hook used below.
  extend ActiveSupport::Concern

  # `\A` and `\z` match the start and the end of the whole string. `^` and
  # `$` would match at any line break, which lets a second line slip through.
  SIGNATURE_FORMAT = /\A[0-9a-f]{64}\z/
  TIMESTAMP_FORMAT = /\A[0-9]{1,12}\z/
  NONCE_FORMAT = /\A[A-Za-z0-9_-]{16,64}\z/

  # The block runs inside the controller class at the moment it includes
  # this module, as if the line were written there.
  included do
    # Runs the method before every action. If the method renders a response,
    # Rails stops there and the action never runs.
    before_action :verify_signed_request
  end

  private

  def verify_signed_request
    # `.to_s` turns a missing header, which is nil, into an empty string.
    sent_signature = request.headers["X-Signature"].to_s
    timestamp = request.headers["X-Signature-Timestamp"].to_s
    nonce = request.headers["X-Signature-Nonce"].to_s

    unless well_formed?(sent_signature, timestamp, nonce)
      return render_error("invalid_signature")
    end

    signature = RequestSignature.new(
      http_method: request.request_method,
      # The path with its query string, such as /internal/accounts?limit=10.
      path: request.fullpath,
      timestamp: timestamp,
      nonce: nonce,
      # The body exactly as it arrived, before any JSON parsing.
      body: request.raw_post
    )

    return render_error("stale_timestamp") unless signature.fresh?

    # ENV.fetch raises when the variable is missing. A missing secret must
    # stop the request, never fall back to an empty one.
    unless signature.signed_by?(sent_signature, ENV.fetch("SERVICE_HMAC_SECRET"))
      return render_error("invalid_signature")
    end

    return render_error("replayed_request") unless SignedRequestNonce.remember(nonce)

    SignedRequestNonce.forget_expired
  end

  def well_formed?(sent_signature, timestamp, nonce)
    SIGNATURE_FORMAT.match?(sent_signature) &&
      TIMESTAMP_FORMAT.match?(timestamp) &&
      NONCE_FORMAT.match?(nonce)
  end
end
