# What: the enforcement actions on one account: suspend, unsuspend and mark
#   as spam.
# Convention: config/routes.rb sends POST /internal/accounts/:account_id/suspend
#   to the method `suspend` of this class, and the same for the other two.
#   Each public method of a controller is an action.
# Closest equivalent: a NestJS controller, an Express router file.
#
# The signature was already checked by the time anything here runs, because
# Internal::BaseController includes SignedRequest.
#
# `params.expect(:name)` is strong params. It returns the value of one field
# and raises ActionController::ParameterMissing when the field is missing,
# blank, or an array or object where one value was expected. The base
# controller turns that into 422 invalid_request.
#
# The three actions differ only in the service they call, so each is one
# line and the shared steps are in `enforce`.

module Internal
  class AccountsController < BaseController
    # Which code each refusal is answered with.
    REFUSAL_CODES = {
      SuspendAccount::AlreadySuspended => "already_suspended",
      UnsuspendAccount::NotSuspended => "not_suspended",
      UnsuspendAccount::BlockedByLockdown => "blocked_by_lockdown",
      MarkAccountAsSpam::AlreadyMarkedSpam => "already_marked_spam"
    }.freeze

    # Filters run in the order they are declared, after the two the parent
    # class declared. Each one stops the request when it renders.
    before_action :load_enforcer
    before_action :load_account

    def suspend
      enforce(SuspendAccount)
    end

    def unsuspend
      enforce(UnsuspendAccount)
    end

    def mark_spam
      enforce(MarkAccountAsSpam)
    end

    private

    def load_enforcer
      load_actor_who_may("accounts.enforce")
    end

    def load_account
      @account = Account.find_by(id: params.expect(:account_id))

      render_error("account_not_found") if @account.nil?
    end

    # service_class - SuspendAccount, UnsuspendAccount or MarkAccountAsSpam.
    #   A class is an object in Ruby, so it can be passed as an argument.
    def enforce(service_class)
      reason = params.expect(:reason)

      # The block after `run do` is the action. IdempotentRequest decides
      # whether to run it or to return a stored answer.
      answer = idempotent_request(reason).run do
        result = service_class.new(
          account: @account, staff_user: @actor, reason: reason, correlation_id: correlation_id
        ).call

        logger.info(
          "Enforcement action written. action_type=#{result.enforcement_action.action_type} " \
          "account_id=#{@account.id} staff_user_id=#{@actor.id} " \
          "enforcement_action_id=#{result.enforcement_action.id} audit_log_id=#{result.audit_log.id}"
        )
        IdempotentRequest::Response.new(
          status: 201, body: EnforcementResultSerializer.new(result).as_json, repeated: false
        )
      end

      if answer.repeated
        logger.info("Stored answer returned for a repeated idempotency key. account_id=#{@account.id} staff_user_id=#{@actor.id}")
      end
      render json: answer.body, status: answer.status
    # A `rescue` at the end of a method catches what the method body raised.
    rescue IdempotentRequest::InvalidKey
      render_error("invalid_request")
    rescue IdempotentRequest::KeyReused
      render_error("idempotency_key_reused")
    # `=> refusal` gives the exception a name, so its class can be looked up.
    rescue AccountEnforcement::Refused => refusal
      render_error(REFUSAL_CODES.fetch(refusal.class))
    end

    def idempotent_request(reason)
      IdempotentRequest.new(
        # Read without strong params, because nil is allowed here. The
        # service accepts nil or a UUID and refuses everything else.
        key: params[:idempotency_key],
        staff_user: @actor,
        # The method and the path without the query string.
        request_path: "#{request.request_method} #{request.path}",
        # What makes two requests the same request. The key is left out.
        payload: { "actor_staff_user_id" => @actor.id, "reason" => reason }
      )
    end
  end
end
