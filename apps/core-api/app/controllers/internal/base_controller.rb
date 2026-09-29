# What: the parent of every controller the handlers call. It checks the
#   signature, picks the correlation id, loads the acting staff user and
#   turns every failure into the one error envelope.
# Convention: a controller in app/controllers/internal/ lives in the module
#   Internal, and its routes sit under /internal. Rails autoloads by path, so
#   internal/base_controller.rb must define Internal::BaseController.
# Closest equivalent: a NestJS module with a global guard and an exception
#   filter, an Express router with its own middleware and error handler.
#
# The health check at /up does not inherit from this class, so it needs no
# signature.
#
# Log lines written here hold ids and codes only. The correlation id is not
# written into the message, because the log tag set in
# config/application.rb already puts it in front of every line.

module Internal
  class BaseController < ApplicationController
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
      "idempotency_key_reused" => [ :unprocessable_content, "This idempotency key was used for another request." ],
      "already_suspended" => [ :conflict, "The account is already suspended." ],
      "not_suspended" => [ :conflict, "The account is not suspended." ],
      "blocked_by_lockdown" => [ :conflict, "Unsuspending is switched off while the mode is lockdown." ],
      "already_marked_spam" => [ :conflict, "The account is already marked as spam." ],
      "mode_unchanged" => [ :conflict, "That mode is already in force." ],
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
    # Raised for a body that is not valid JSON, for a required field that is
    # missing, blank or of the wrong shape, and for a bad reason.
    rescue_from ActionDispatch::Http::Parameters::ParseError,
      ActionController::BadRequest,
      ActionController::ParameterMissing,
      Reason::Invalid,
      with: :render_invalid_request

    # Filters run in the order they are declared. This one comes before the
    # signature check that SignedRequest adds, so a refused signature is
    # answered with the same correlation id as everything else.
    before_action :remember_correlation_id
    include SignedRequest

    private

    # The id that ties this request to the log lines of the browser and the
    # handlers. CorrelationId picked it when the log tag was built, and
    # gives the same one here.
    def remember_correlation_id
      Current.correlation_id = CorrelationId.resolve(request)
    end

    def correlation_id
      Current.correlation_id
    end

    # Loads the acting staff user and checks one permission. The id travels
    # inside the signed body. The group is read from the database here, and
    # a group sent by the caller would be ignored.
    #
    # A controller calls this from a before_action of its own, with the
    # permission its actions need.
    def load_actor_who_may(permission)
      # find_by returns nil when no row matches, where find would raise.
      # A variable starting with `@` belongs to this controller instance and
      # is still there when the action runs.
      @actor = StaffUser.find_by(id: params.expect(:actor_staff_user_id))
      # `&.` calls the method only when the receiver is not nil.
      Current.staff_user_id = @actor&.id

      # nil counts as false, so a missing actor is refused too.
      render_error("forbidden") unless @actor&.permission?(permission)
    end

    def render_error(code)
      # Destructuring: the first element goes to status, the second to message.
      status, message = ERRORS.fetch(code)

      logger.warn("Answered with an error. code=#{code} staff_user_id=#{Current.staff_user_id || 'none'}")
      render json: { error: { code: code, message: message, correlation_id: correlation_id } },
        status: status
    end

    def render_invalid_request
      render_error("invalid_request")
    end

    # The client gets the generic sentence. The class, the message and the
    # top of the stack trace go to the log.
    def render_internal_error(exception)
      logger.error("Unexpected error. exception=#{exception.class} message=#{exception.message}")
      logger.error(exception.backtrace&.first(15)&.join("\n"))

      render_error("internal_error")
    end
  end
end
