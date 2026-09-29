# What: a person who uses the console, and what that person may do.
# Convention: a class in app/models/ that inherits from ApplicationRecord maps
#   to a table. Rails turns the class name StaffUser into the table name
#   staff_users, and gives the class one reader and one writer per column.
# Closest equivalent: a TypeORM entity in NestJS, a Django model.
#
# The runtime database user holds SELECT only on this table. Rails reads
# staff users and never changes them. The seed creates them as the admin user.

class StaffUser < ApplicationRecord
  # Which permissions each group holds. This must equal
  # packages/shared/fixtures/group_permissions.json, and a test compares them.
  # `%w[a b]` is shorthand for ["a", "b"]. `.freeze` makes an object
  # read-only. Freezing the hash does not freeze the arrays inside it, so
  # each array is frozen too.
  GROUP_PERMISSIONS = {
    "viewer" => %w[accounts.read audit.read].freeze,
    "analyst" => %w[accounts.read audit.read accounts.search_pii pii.reveal].freeze,
    "enforcer" => %w[
      accounts.read audit.read accounts.search_pii pii.reveal
      accounts.enforce accounts.bulk_enforce mode.change
    ].freeze
  }.freeze

  GROUPS = GROUP_PERMISSIONS.keys.freeze

  # Adds a `password=` writer that stores a bcrypt hash in password_digest,
  # and an `authenticate(password)` method. It also validates that a new
  # record has a password.
  has_secure_password

  # A validation runs before every save. A record that fails is not written,
  # and the reasons are listed in `errors`.
  # `uniqueness` runs a SELECT first. The unique index on email is what
  # settles two inserts that arrive together.
  validates :email, presence: true, uniqueness: true
  validates :display_name, presence: true
  validates :group_name, presence: true, inclusion: { in: GROUPS }

  # Returns the permissions of this user's group, or an empty array for a
  # group that is not in the map.
  def permissions
    GROUP_PERMISSIONS.fetch(group_name, [])
  end

  # Code asks this question and never compares group names. A method name
  # ending in `?` returns true or false.
  def permission?(name)
    permissions.include?(name.to_s)
  end
end
