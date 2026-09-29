# What: the `bin/rails db:grants` command.
# Convention: Rails loads every .rake file in lib/tasks/ and turns each
#   `task` into a command. `namespace :db` puts it next to the built-in
#   db:migrate and db:seed.
# Closest equivalent: an npm script that runs a small Node file.

namespace :db do
  desc "Give the two runtime database users their table privileges"
  # `grants: :environment` means: load the Rails app first, then run the block.
  task grants: :environment do
    DatabaseGrants.apply!
    puts "Grants applied to #{ActiveRecord::Base.connection.current_database}."
  end
end
