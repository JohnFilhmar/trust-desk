# What: the enforcement actions on one account. For now that is suspend.
# Convention: config/routes.rb sends POST /internal/accounts/:account_id/suspend
#   to the method `suspend` of this class. Each public method of a controller
#   is an action.
# Closest equivalent: a NestJS controller, an Express router file.
#
# The signature was already checked by the time anything here runs, because
# Internal::BaseController includes SignedRequest.
#
# `params.expect(:name)` is strong params. It returns the value of one field
# and raises ActionController::ParameterMissing when the field is missing,
# blank, or an array or object where one value was expected. The base
# controller turns that into 422 invalid_request.

module Internal
  class AccountsController < BaseController
    # Filters run in the order they are declared, after the signature check
    # the parent class declared. Each one stops the request when it renders.
    before_action :load_actor_who_may_enforce
    before_action :load_account

    def suspend
      result = SuspendAccount.new(
        account: @account,
        staff_user: @actor,
        reason: params.expect(:reason),
        correlation_id: correlation_id
      ).call

      logger.info(
        "Account suspended. account_id=#{@account.id} staff_user_id=#{@actor.id} " \
        "enforcement_action_id=#{result.enforcement_action.id} " \
        "audit_log_id=#{result.audit_log.id} correlation_id=#{correlation_id}"
      )
      render json: EnforcementResultSerializer.new(result).as_json, status: :created
    # A `rescue` at the end of a method catches what the method body raised.
    rescue SuspendAccount::InvalidReason
      render_error("invalid_request")
    rescue SuspendAccount::AlreadySuspended
      render_error("already_suspended")
    end

    private

    # The actor's id travels inside the signed body. The group is read from
    # the database here. A group sent by the caller would be ignored.
    def load_actor_who_may_enforce
      # find_by returns nil when no row matches, where find would raise.
      # A variable starting with `@` belongs to this controller instance and
      # is still there when the action runs.
      @actor = StaffUser.find_by(id: params.expect(:actor_staff_user_id))

      # `&.` returns nil for a missing actor, and nil counts as false.
      render_error("forbidden") unless @actor&.permission?("accounts.enforce")
    end

    def load_account
      @account = Account.find_by(id: params.expect(:account_id))

      render_error("account_not_found") if @account.nil?
    end
  end
end
