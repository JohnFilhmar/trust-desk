# What: the body Rails answers with after an enforcement action.
# Convention: Rails has no folder for serializers. This app uses
#   app/serializers/, which Rails autoloads like every folder under app/.
# Closest equivalent: a response DTO in NestJS, a serializer in Django REST
#   framework.
#
# The shape must match packages/shared/fixtures/enforcement_result.json key
# for key. A request test compares the two.

class EnforcementResultSerializer
  # `result` is a SuspendAccount::Result.
  def initialize(result)
    @result = result
  end

  def as_json
    {
      enforcement_action: EnforcementActionSerializer.new(@result.enforcement_action).as_json,
      account: AccountStateSerializer.new(@result.account).as_json,
      audit_log_id: @result.audit_log.id
    }
  end
end
