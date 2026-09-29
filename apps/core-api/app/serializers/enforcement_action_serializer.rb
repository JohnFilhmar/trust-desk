# What: the JSON form of one enforcement action.
# Convention: Rails has no folder for serializers. This app uses
#   app/serializers/, which Rails autoloads like every folder under app/.
#   See docs/decisions/002-rails-serializers.md.
# Closest equivalent: a response DTO in NestJS, a serializer in Django REST
#   framework.
#
# Every field is listed by hand. A new column stays out of the response
# until someone adds it here.

class EnforcementActionSerializer
  def initialize(enforcement_action)
    @enforcement_action = enforcement_action
  end

  # Returns a hash. `render json:` turns it into JSON text.
  def as_json
    {
      id: @enforcement_action.id,
      account_id: @enforcement_action.account_id,
      staff_user_id: @enforcement_action.staff_user_id,
      action_type: @enforcement_action.action_type,
      reason: @enforcement_action.reason,
      correlation_id: @enforcement_action.correlation_id,
      # UTC, six fractional digits and a Z: 2026-09-30T01:02:03.456789Z.
      created_at: @enforcement_action.created_at.utc.iso8601(6)
    }
  end
end
