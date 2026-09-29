# What: picks the correlation id of a request, once, and remembers it for
#   the rest of that request.
# Convention: config.autoload_lib makes every file under lib/ loadable by
#   its constant name, here CorrelationId.
# Closest equivalent: apps/handlers/src/lib/http/correlation_id.ts.
#
# Two places ask for the id: the log tag in config/application.rb, which
# runs before any controller, and Internal::BaseController. Both must get
# the same value, also when the id had to be made up. So the id is stored
# in the Rack env of the request, the hash that travels with one request
# through every middleware and into the controller.

module CorrelationId
  # Rack gives every HTTP header an upper-case name that starts with HTTP_.
  HEADER = "HTTP_X_CORRELATION_ID"
  # A key of our own in the Rack env. The dot keeps it apart from headers.
  ENV_KEY = "trust_desk.correlation_id"

  module_function

  # request - an ActionDispatch::Request
  #
  # The header is not covered by the signature and ends up in the log, so
  # anything but a UUID is replaced by a new one.
  def resolve(request)
    remembered = request.get_header(ENV_KEY)
    return remembered if remembered

    sent = request.get_header(HEADER)
    id = Uuid.valid?(sent) ? sent : SecureRandom.uuid
    request.set_header(ENV_KEY, id)
    id
  end
end
