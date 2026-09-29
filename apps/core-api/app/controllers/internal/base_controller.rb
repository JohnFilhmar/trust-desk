# What: the parent of every controller the handlers call. It checks the
#   signature, picks the correlation id and turns every failure into the one
#   error envelope.
# Convention: a controller in app/controllers/internal/ lives in the module
#   Internal, and its routes sit under /internal. Rails autoloads by path, so
#   internal/base_controller.rb must define Internal::BaseController.
# Closest equivalent: a NestJS module with a global guard and an exception
#   filter, an Express router with its own middleware and error handler.
#
# The health check at /up does not inherit from this class, so it needs no
# signature.

module Internal
  class BaseController < ApplicationController
    # Versions 1 to 8, the same rule zod applies in the handlers. `\h` is one
    # hex digit.
    UUID_FORMAT = /\A\h{8}-\h{4}-[1-8]\h{3}-[89abAB]\h{3}-\h{12}\z/

    # Every code this service can answer with, its HTTP status and the
    # sentence sent with it. The sentences are generic on purpose. The detail
    # goes to the log.
    ERRORS = {
      "invalid_signature" => [ :unauthorized, "The request signature is missing or wrong." ],
      "stale_timestamp" => [ :unauthorized, "The request timestamp is outside the allowed window." ],
      "replayed_request" => [ :unauthorized, "This request was already received." ],
      "forbidden" => [ :forbidden, "This staff user may not do that." ],
      "account_not_found" => [ :not_found, "No account has that id." ],
      "not_found" => [ :not_found, "No such endpoint." ],
      "invalid_request" => [ :unprocessable_content, "The request body is missing a field or holds a bad value." ],
      "already_suspended" => [ :conflict, "The account is already suspended." ],
      "internal_error" => [ :internal_server_error, "Something went wrong. Nothing was changed." ]
    }.freeze

    # For a JSON request Rails copies the body's keys under a second key
    # named after the controller. This switches that off, so params holds
    # what was sent and nothing else.
    wrap_parameters false

    # rescue_from turns an exception raised anywhere in an action or a
    # before_action into a call to the named method. Rails tries the lines
    # from the bottom up, so the catch-all comes first and the specific
    # classes after it.
    rescue_from StandardError, with: :render_internal_error
    # Raised for a body that is not valid JSON, and for a required field that
    # is missing, blank or of the wrong shape.
    rescue_from ActionDispatch::Http::Parameters::ParseError,
      ActionController::BadRequest,
      ActionController::ParameterMissing,
      with: :render_invalid_request

    include SignedRequest

    private

    # The id that ties this request to the log lines of the browser and the
    # handlers. The header is not covered by the signature and ends up in the
    # log, so anything but a UUID is replaced.
    def correlation_id
      # `||=` assigns only when the left side is nil, so the id is picked
      # once per request and then reused.
      @correlation_id ||= begin
        sent = request.headers["X-Correlation-Id"].to_s
        UUID_FORMAT.match?(sent) ? sent : SecureRandom.uuid
      end
    end

    def render_error(code)
      # Destructuring: the first element goes to status, the second to message.
      status, message = ERRORS.fetch(code)

      logger.warn("Answered with an error. code=#{code} correlation_id=#{correlation_id}")
      render json: { error: { code: code, message: message, correlation_id: correlation_id } },
        status: status
    end

    def render_invalid_request
      render_error("invalid_request")
    end

    # The client gets the generic sentence. The class, the message and the
    # top of the stack trace go to the log.
    def render_internal_error(exception)
      logger.error(
        "Unexpected error. correlation_id=#{correlation_id} " \
        "exception=#{exception.class} message=#{exception.message}"
      )
      # `&.` calls the method only when the receiver is not nil.
      logger.error(exception.backtrace&.first(15)&.join("\n"))

      render_error("internal_error")
    end
  end
end
