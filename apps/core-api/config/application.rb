# What: the settings shared by every environment, and the list of Rails
#   frameworks this app loads.
# Convention: Rails requires config/application.rb from config/environment.rb
#   at boot. Files in config/environments/ run afterwards and can override it.
# Closest equivalent: AppModule plus main.ts in NestJS, settings/base.py in
#   Django.

require_relative "boot"

require "rails"
# Rails is a set of frameworks. Each require below switches one on. The
# commented lines are the ones `rails new` left off because we skipped them.
require "active_model/railtie"
# require "active_job/railtie"
require "active_record/railtie"
# require "active_storage/engine"
require "action_controller/railtie"
# require "action_mailer/railtie"
# require "action_mailbox/engine"
# require "action_text/engine"
require "action_view/railtie"
# require "action_cable/engine"
require "rails/test_unit/railtie"

# Loads every gem in the Gemfile that belongs to the current environment.
Bundler.require(*Rails.groups)

module CoreApi
  class Application < Rails::Application
    # Uses the default behaviors of Rails 8.1 rather than those of an older version.
    config.load_defaults 8.1

    # Makes files under lib/ loadable by name, without a require line.
    config.autoload_lib(ignore: %w[assets tasks])

    # Leaves out cookies, sessions, flash and views. The handlers own the session.
    config.api_only = true

    # Time.current and every timestamp column use UTC.
    config.time_zone = "UTC"
    config.active_record.default_timezone = :utc

    # Dumps the schema as SQL into db/structure.sql. The default, db/schema.rb,
    # is Ruby and cannot describe a trigger, so the test database would be
    # built without the one that makes audit_logs append-only.
    config.active_record.schema_format = :sql
  end
end
