# What: tests for the StaffUser model and its permissions.
# Convention: tests for app/models/staff_user.rb go in
#   test/models/staff_user_test.rb. The test folder mirrors the app folder.
# Closest equivalent: packages/shared/src/lib/permissions.test.ts, which
#   reads the same fixture.

require "test_helper"

class StaffUserTest < ActiveSupport::TestCase
  test "the permissions map equals the shared fixture" do
    assert_equal shared_fixture("group_permissions.json"), StaffUser::GROUP_PERMISSIONS
  end

  test "only an enforcer may enforce" do
    assert staff_users(:enforcer).permission?("accounts.enforce")
    assert_not staff_users(:analyst).permission?("accounts.enforce")
    assert_not staff_users(:viewer).permission?("accounts.enforce")
  end

  test "a permission may be asked for as a symbol" do
    assert staff_users(:viewer).permission?(:"accounts.read")
  end

  test "a user in an unknown group holds no permission" do
    user = StaffUser.new(group_name: "owner")

    assert_empty user.permissions
    assert_not user.permission?("accounts.read")
  end

  test "the group must be one of the three" do
    user = new_staff_user(group_name: "owner")

    # `valid?` runs the validations and returns false when one fails.
    assert_not user.valid?
    assert user.errors.include?(:group_name)
  end

  test "the group is required" do
    user = new_staff_user(group_name: nil)

    assert_not user.valid?
    assert user.errors.include?(:group_name)
  end

  test "the email must be unique" do
    user = new_staff_user(email: staff_users(:viewer).email)

    assert_not user.valid?
    assert user.errors.include?(:email)
  end

  test "the password is stored as a bcrypt hash and can be checked" do
    user = new_staff_user
    user.save!

    assert_not_equal "a-long-test-password", user.password_digest
    # authenticate returns the user for the right password and false otherwise.
    assert user.authenticate("a-long-test-password")
    assert_not user.authenticate("wrong")
  end

  test "the fixture users accept the demo password" do
    password = shared_fixture("demo_accounts.json").fetch("password")

    assert staff_users(:enforcer).authenticate(password)
  end

  private

  # `**overrides` collects the keyword arguments into a hash.
  def new_staff_user(**overrides)
    defaults = {
      email: "new-user@example.com",
      display_name: "New User",
      group_name: "viewer",
      password: "a-long-test-password"
    }
    StaffUser.new(defaults.merge(overrides))
  end
end
