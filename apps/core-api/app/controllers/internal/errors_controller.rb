# What: answers any path under /internal that no other route matched, so
#   that an unknown path gets the error envelope and never a Rails error page.
# Convention: the last route inside the internal namespace in
#   config/routes.rb catches every remaining path and sends it here.
# Closest equivalent: the final `app.use` in an Express router that answers
#   404.
#
# It inherits the signature check, so a caller without the secret learns
# nothing about which paths exist.

module Internal
  class ErrorsController < BaseController
    def not_found
      render_error("not_found")
    end
  end
end
