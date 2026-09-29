# What: the one rule for the reason a staff user gives: 10 to 500
#   characters once the spaces around it are removed.
# Convention: config.autoload_lib makes every file under lib/ loadable by
#   its constant name, here Reason.
# Closest equivalent: `reason_schema` in
#   packages/shared/src/schemas/enforcement.ts.
#
# Enforcement, a PII reveal and a mode change all ask for a reason, so the
# rule lives here and every service calls it.

module Reason
  # A range. `LENGTH.cover?(12)` is true when 12 lies inside it.
  LENGTH = (10..500)

  # Raised for a reason that is missing, too short or too long.
  # Internal::BaseController turns it into 422 invalid_request.
  class Invalid < StandardError; end

  module_function

  # Returns the reason without the spaces around it, or raises.
  # `to_s` turns nil into an empty string, which is too short.
  def clean!(raw)
    text = raw.to_s.strip
    raise Invalid unless LENGTH.cover?(text.length)

    text
  end
end
