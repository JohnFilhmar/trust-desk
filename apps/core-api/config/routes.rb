# What: the list of every URL this app answers, and which controller method
#   each one reaches.
# Convention: Rails reads config/routes.rb at boot. `bin/rails routes` prints
#   the result.
# Closest equivalent: the router file of an Express app, the controller
#   decorators of NestJS collected in one place, urls.py in Django.

Rails.application.routes.draw do
  # Answers 200 when the app has booted. It needs no signature, and the
  # Compose health check calls it.
  get "up" => "rails/health#show", as: :rails_health_check

  # `namespace :internal` does two things: it puts /internal in front of
  # every path in the block, and it looks for the controllers in the module
  # Internal, in app/controllers/internal/.
  namespace :internal do
    # "accounts#suspend" means the method `suspend` of AccountsController.
    # `:account_id` is a path parameter and arrives in params[:account_id].
    post "accounts/:account_id/suspend", to: "accounts#suspend"

    # Catches every other path under /internal, whatever the HTTP method.
    # `*unmatched` takes the rest of the path, slashes included. It must
    # stay last, because Rails uses the first route that matches.
    match "*unmatched", to: "errors#not_found", via: :all
  end
end
