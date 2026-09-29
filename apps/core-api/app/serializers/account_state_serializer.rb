# What: the JSON form of an account after an enforcement action. It holds
#   the id and the two fields enforcement can change, and no PII.
# Convention: Rails has no folder for serializers. This app uses
#   app/serializers/, which Rails autoloads like every folder under app/.
# Closest equivalent: a response DTO in NestJS, a serializer in Django REST
#   framework.

class AccountStateSerializer
  def initialize(account)
    @account = account
  end

  def as_json
    {
      id: @account.id,
      status: @account.status,
      # `&.` returns nil when the account was never marked as spam.
      spam_marked_at: @account.spam_marked_at&.utc&.iso8601(6)
    }
  end
end
