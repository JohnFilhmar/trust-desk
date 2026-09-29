# What: the `bin/rails db:seed_if_empty` command.
# Convention: Rails loads every .rake file in lib/tasks/ and turns each
#   `task` into a command.
# Closest equivalent: an npm script that checks a condition before it runs
#   another script.
#
# `bin/rails db:prepare` seeds only when it has just created the database.
# Here the MySQL container creates the database before Rails ever connects,
# so db:prepare never seeds. This task fills that gap, and it leaves an
# existing database alone, so restarting the stack does not undo what
# someone did in the console.

namespace :db do
  desc "Load the demo data, but only into a database that has no accounts"
  task seed_if_empty: :environment do
    # exists? runs SELECT 1 ... LIMIT 1 and loads no record.
    if Account.exists?
      puts "Seed skipped, the database already holds accounts. " \
           "To reset the demo data, run: bin/rails db:seed"
    else
      # Runs another task by name, as if it had been typed.
      Rake::Task["db:seed"].invoke
    end
  end
end
