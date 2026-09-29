# What: the body Rails answers with once a PII reveal is recorded.
# Convention: Rails has no folder for serializers. This app uses
#   app/serializers/, which Rails autoloads like every folder under app/.
# Closest equivalent: a response DTO in NestJS.
#
# The shape must match packages/shared/fixtures/internal_reveal_result.json.
# It holds the id of the audit row and no PII.

class RevealResultSerializer
  def initialize(audit_log)
    @audit_log = audit_log
  end

  def as_json
    { audit_log_id: @audit_log.id }
  end
end
