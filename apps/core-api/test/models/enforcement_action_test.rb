# What: tests for the rules on an enforcement action, mostly the reason.
# Convention: tests for app/models/enforcement_action.rb go in
#   test/models/enforcement_action_test.rb.
# Closest equivalent: a Jest unit test of a zod schema.

require "test_helper"

class EnforcementActionTest < ActiveSupport::TestCase
  test "a reason of 10 characters is accepted and one of 9 is not" do
    assert new_action(reason: "a" * 10).valid?

    action = new_action(reason: "a" * 9)
    assert_not action.valid?
    assert action.errors.include?(:reason)
  end

  test "a reason of 500 characters is accepted and one of 501 is not" do
    assert new_action(reason: "a" * 500).valid?
    assert_not new_action(reason: "a" * 501).valid?
  end

  test "the length is measured after the spaces around the reason are removed" do
    action = new_action(reason: "   123456789   ")

    assert_not action.valid?
    assert_equal "123456789", action.reason
  end

  test "a missing or blank reason is refused" do
    assert_not new_action(reason: nil).valid?
    assert_not new_action(reason: "            ").valid?
  end

  test "the action type must be one of the three" do
    assert new_action(action_type: "unsuspend").valid?
    assert new_action(action_type: "mark_spam").valid?
    assert_not new_action(action_type: "delete").valid?
  end

  test "a saved action has created_at, and the table has no updated_at" do
    action = new_action
    action.save!

    assert_not_nil action.created_at
    assert_not EnforcementAction.column_names.include?("updated_at")
  end

  private

  def new_action(**overrides)
    defaults = {
      account: accounts(:active_account),
      staff_user: staff_users(:enforcer),
      action_type: "suspend",
      reason: "Twelve accounts share this fingerprint.",
      correlation_id: "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f"
    }
    EnforcementAction.new(defaults.merge(overrides))
  end
end
