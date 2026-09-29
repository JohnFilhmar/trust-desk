# What: the body Rails answers with after a mode change.
# Convention: Rails has no folder for serializers. This app uses
#   app/serializers/, which Rails autoloads like every folder under app/.
# Closest equivalent: a response DTO in NestJS.
#
# The shape must match
# packages/shared/fixtures/internal_mode_change_result.json key for key.

class ModeChangeResultSerializer
  # `result` is a ChangeOperationalMode::Result.
  def initialize(result)
    @result = result
  end

  def as_json
    {
      operational_mode: OperationalModeSerializer.new(@result.operational_mode).as_json,
      audit_log_id: @result.audit_log.id
    }
  end
end
