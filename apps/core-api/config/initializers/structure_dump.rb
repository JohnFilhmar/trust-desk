# What: extra flags for the mysqldump call that writes db/structure.sql.
# Convention: Rails runs every file in config/initializers/ once at boot,
#   after the frameworks are loaded, in alphabetical order.
# Closest equivalent: a module imported for its side effect in main.ts.
#
# Without this flag mysqldump also tries to dump tablespaces, which needs a
# server-wide privilege the admin user does not hold and does not need.

ActiveRecord::Tasks::DatabaseTasks.structure_dump_flags = [ "--no-tablespaces" ]
