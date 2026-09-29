# What: makes a request safe to send twice. The first time it runs the
#   action and stores the answer under the key the browser sent. Every later
#   time it returns the stored answer and runs nothing.
# Convention: a service object in app/services/. The file
#   idempotent_request.rb must define IdempotentRequest.
# Closest equivalent: an idempotency middleware in Express, an interceptor
#   in NestJS.
#
# How it is used:
#
#   answer = IdempotentRequest.new(key: ..., ...).run do
#     # the action, which returns an IdempotentRequest::Response
#   end
#
# The rules:
#   - no key: the action runs, nothing is stored
#   - key never seen: the action runs, and its answer is stored in the SAME
#     transaction, so a stored answer exists exactly when the action happened
#   - key seen with the same path and the same body: the stored answer
#   - key seen with another path or another body: KeyReused
#   - only a success is stored. A refusal raises, the transaction is rolled
#     back, and the same key can be sent again once the problem is fixed
#
# This is not the replay protection of SignedRequest. A repeated key arrives
# in a new signed request with a new nonce. A copy of the same signed
# request is refused earlier, by the nonce.

class IdempotentRequest
  # Raised when the key is there and is not a UUID.
  class InvalidKey < StandardError; end
  # Raised when the key was stored for another path or another body.
  class KeyReused < StandardError; end

  # status   - the HTTP status, such as 201
  # body     - the hash that becomes the JSON body
  # repeated - true when this is a stored answer and the action did not run
  Response = Data.define(:status, :body, :repeated)

  # key          - the idempotency key as sent, or nil
  # staff_user   - the StaffUser acting
  # request_path - the method and the path, such as
  #                "POST /internal/accounts/42/suspend"
  # payload      - the parts of the body that make two requests "the same",
  #                as a hash. The key itself is not among them.
  def initialize(key:, staff_user:, request_path:, payload:)
    @key = key
    @staff_user = staff_user
    @request_path = request_path
    @payload = payload
  end

  # `yield` runs the block the caller wrote after `run do`.
  def run
    return yield if @key.nil?
    raise InvalidKey unless Uuid.valid?(@key)

    stored = find_stored
    return answer_from(stored) if stored

    run_and_store { yield }
  end

  private

  def run_and_store
    # The action opens its own transaction inside this one. Rails joins the
    # two, so the action and the stored answer are committed together.
    IdempotencyKey.transaction do
      response = yield
      store(response)
      response
    end
  # Another request stored the same key after find_stored looked and before
  # this insert. The unique index let that one through and failed this one,
  # which rolled this transaction back, action included.
  rescue ActiveRecord::RecordNotUnique
    answer_from(IdempotencyKey.find_by!(key: @key))
  # Two identical requests at once both pass find_stored. The row lock then
  # lets one act. The other waits, finds the state already changed and is
  # refused. By then the first has stored its answer, so look once more.
  # `=> refusal` gives the exception a name.
  rescue AccountEnforcement::Refused => refusal
    stored = find_stored
    raise refusal if stored.nil?

    answer_from(stored)
  end

  def find_stored
    IdempotencyKey.find_by(key: @key)
  end

  def store(response)
    IdempotencyKey.create!(
      key: @key,
      staff_user: @staff_user,
      request_path: @request_path,
      request_hash: request_hash,
      response_status: response.status,
      response_body: response.body
    )
  end

  def answer_from(stored)
    same_request = stored.request_path == @request_path && stored.request_hash == request_hash
    raise KeyReused unless same_request

    Response.new(status: stored.response_status, body: stored.response_body, repeated: true)
  end

  # SHA-256 of the payload in one fixed form. `sort` orders the pairs by
  # key and `to_h` turns them back into a hash, so the order in which the
  # caller listed the keys cannot change the result.
  def request_hash
    canonical = @payload.sort.to_h.to_json

    OpenSSL::Digest::SHA256.hexdigest(canonical)
  end
end
