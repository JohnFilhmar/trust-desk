# What: tests for the rule on reasons in lib/reason.rb.
# Convention: tests for code in lib/ go in test/lib/.
# Closest equivalent: a Jest unit test of a zod schema.

require "test_helper"

class ReasonTest < ActiveSupport::TestCase
  test "a reason of 10 to 500 characters is returned as it is" do
    assert_equal "a" * 10, Reason.clean!("a" * 10)
    assert_equal "a" * 500, Reason.clean!("a" * 500)
  end

  test "the spaces around a reason are removed before it is measured" do
    assert_equal "Ten chars.", Reason.clean!("  Ten chars.\n")
    assert_raises(Reason::Invalid) { Reason.clean!("   123456789   ") }
  end

  test "a reason that is missing, blank, too short or too long is refused" do
    [ nil, "", "          ", "a" * 9, "a" * 501 ].each do |raw|
      assert_raises(Reason::Invalid, "#{raw.inspect} was accepted") { Reason.clean!(raw) }
    end
  end
end
