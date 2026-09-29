# What: the one rule for what counts as a UUID in this service.
# Convention: config.autoload_lib makes every file under lib/ loadable by
#   its constant name. The file is uuid.rb, so Rails expects it to define
#   Uuid.
# Closest equivalent: `z.uuid()` from zod, which the handlers use.
#
# The rule is the one zod applies: versions 1 to 8, and a variant of 8, 9,
# a or b. A value Rails accepts is then always one the handlers accept.

module Uuid
  # `\h` is one hex digit. `\A` and `\z` are the start and the end of the
  # whole string.
  FORMAT = /\A\h{8}-\h{4}-[1-8]\h{3}-[89abAB]\h{3}-\h{12}\z/

  module_function

  # Anything that is not a string, nil included, is not a UUID.
  def valid?(value)
    value.is_a?(String) && FORMAT.match?(value)
  end
end
