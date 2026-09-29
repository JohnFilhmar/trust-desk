# What: the three staff users of the demo, one per group.
# Convention: none. db/seeds.rb loads this file with require_relative.
# Closest equivalent: packages/shared/src/lib/demo_accounts.ts.
#
# The list must equal packages/shared/fixtures/demo_accounts.json, and a test
# compares them. The values are repeated here because the seed also runs in
# production, where that fixture file is not present.
#
# The password is public on purpose. This is a demo with synthetic data.

module Seeds
  module DemoStaffUsers
    PASSWORD = "trust-desk-demo-2026"

    # The order sets the ids: viewer is 1, analyst is 2, enforcer is 3.
    USERS = [
      { email: "viewer@example.com", display_name: "Demo Viewer", group_name: "viewer" },
      { email: "analyst@example.com", display_name: "Demo Analyst", group_name: "analyst" },
      { email: "enforcer@example.com", display_name: "Demo Enforcer", group_name: "enforcer" }
    ].freeze

    module_function

    # Goes through the model, so has_secure_password writes the bcrypt hash.
    # bcrypt salts every hash, so password_digest differs from run to run
    # while the password stays the same.
    def create!
      # each_with_index passes the position along with the element.
      USERS.each_with_index do |user, index|
        StaffUser.create!(user.merge(id: index + 1, password: PASSWORD))
      end
    end
  end
end
