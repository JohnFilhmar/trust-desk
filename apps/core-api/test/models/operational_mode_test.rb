# What: tests for the operational mode and how the current one is found.
# Convention: tests for app/models/operational_mode.rb go in
#   test/models/operational_mode_test.rb.
# Closest equivalent: a Jest test against a real database.

require "test_helper"

class OperationalModeTest < ActiveSupport::TestCase
  test "the mode is normal while the table is empty" do
    assert_equal 0, OperationalMode.count
    assert_equal "normal", OperationalMode.current
  end

  test "the current mode is the newest row" do
    create_mode("elevated", created_at: 2.hours.ago)
    create_mode("lockdown", created_at: 1.hour.ago)
    create_mode("normal", created_at: 3.hours.ago)

    assert_equal "lockdown", OperationalMode.current
  end

  test "two rows written at the same moment are settled by the id" do
    moment = 1.hour.ago
    create_mode("elevated", created_at: moment)
    create_mode("lockdown", created_at: moment)

    assert_equal "lockdown", OperationalMode.current
  end

  test "the mode must be one of the three" do
    mode = OperationalMode.new(mode: "panic", reason: "A test.", staff_user: staff_users(:enforcer))

    assert_not mode.valid?
    assert mode.errors.include?(:mode)
  end

  private

  def create_mode(mode, created_at:)
    OperationalMode.create!(
      mode: mode,
      reason: "Set by a test.",
      staff_user: staff_users(:enforcer),
      created_at: created_at
    )
  end
end
