# What: the JSON form of one row of operational_modes.
# Convention: Rails has no folder for serializers. This app uses
#   app/serializers/, which Rails autoloads like every folder under app/.
# Closest equivalent: a response DTO in NestJS.
#
# Every field is listed by hand.

class OperationalModeSerializer
  def initialize(operational_mode)
    @operational_mode = operational_mode
  end

  def as_json
    {
      id: @operational_mode.id,
      mode: @operational_mode.mode,
      reason: @operational_mode.reason,
      staff_user_id: @operational_mode.staff_user_id,
      # UTC, six fractional digits and a Z: 2026-09-30T01:02:03.456789Z.
      created_at: @operational_mode.created_at.utc.iso8601(6)
    }
  end
end
