# What: changes the operational mode.
# Convention: config/routes.rb sends POST /internal/operational_modes to the
#   method `create` of this class. A mode change is a new row, so the action
#   is a create.
# Closest equivalent: a NestJS controller with one POST handler.

module Internal
  class OperationalModesController < BaseController
    before_action :load_mode_changer

    def create
      result = ChangeOperationalMode.new(
        staff_user: @actor,
        mode: params.expect(:mode),
        reason: params.expect(:reason),
        correlation_id: correlation_id
      ).call

      logger.info(
        "Operational mode changed. mode=#{result.operational_mode.mode} staff_user_id=#{@actor.id} " \
        "operational_mode_id=#{result.operational_mode.id} audit_log_id=#{result.audit_log.id}"
      )
      render json: ModeChangeResultSerializer.new(result).as_json, status: :created
    rescue ChangeOperationalMode::InvalidMode
      render_error("invalid_request")
    rescue ChangeOperationalMode::ModeUnchanged
      render_error("mode_unchanged")
    end

    private

    def load_mode_changer
      load_actor_who_may("mode.change")
    end
  end
end
