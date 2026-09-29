# What: records a PII reveal before the handlers unmask anything.
# Convention: config/routes.rb sends POST /internal/reveals to the method
#   `create` of this class. `create` is the name Rails gives to the action
#   that answers a POST to a collection.
# Closest equivalent: a NestJS controller with one POST handler.
#
# This controller returns no PII and reads none. It answers with the id of
# the audit row. The handlers run the unmasked query only after a 201.

module Internal
  class RevealsController < BaseController
    before_action :load_revealer

    def create
      account_id = params.expect(:account_id)
      # exists? asks MySQL whether the row is there and loads no column of
      # it, so no email or IP reaches this process.
      return render_error("account_not_found") unless Account.exists?(id: account_id)

      audit_log = RecordPiiReveal.new(
        account_id: account_id,
        staff_user: @actor,
        reason: params.expect(:reason),
        # `fields: []` means: a list of plain values under the key fields.
        # It raises when the list is missing or empty.
        fields: params.expect(fields: []),
        correlation_id: correlation_id
      ).call

      logger.info(
        "PII reveal recorded. account_id=#{account_id.to_i} staff_user_id=#{@actor.id} " \
        "audit_log_id=#{audit_log.id}"
      )
      render json: RevealResultSerializer.new(audit_log).as_json, status: :created
    rescue RecordPiiReveal::InvalidFields
      render_error("invalid_request")
    end

    private

    def load_revealer
      load_actor_who_may("pii.reveal")
    end
  end
end
