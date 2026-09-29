# What: the values that belong to the request being served right now: its
#   correlation id and the id of the staff user acting.
# Convention: a class that inherits from ActiveSupport::CurrentAttributes,
#   named Current by habit and kept in app/models/. Internal::BaseController
#   fills it in.
# Closest equivalent: AsyncLocalStorage in Node, a request-scoped provider
#   in NestJS.
#
# `Current.correlation_id = "..."` looks like a global variable and is not
# one. Each thread has its own copy, and Puma serves each request on one
# thread, so two requests served at the same moment cannot see each other's
# values.
#
# Rails resets every attribute to nil before and after each request. Puma
# reuses its threads, so without the reset the next request on the same
# thread would start with the staff user of the previous one.
#
# It holds ids and nothing else. Code that needs the account or the staff
# user gets it as an argument, so it stays clear what each method depends on.

class Current < ActiveSupport::CurrentAttributes
  # Defines Current.correlation_id and Current.correlation_id=, and the same
  # pair for staff_user_id.
  attribute :correlation_id, :staff_user_id
end
