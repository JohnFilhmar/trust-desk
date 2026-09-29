# What: tests for the Account model: its status and the columns Rails must
#   never change.
# Convention: tests for app/models/account.rb go in test/models/account_test.rb.
# Closest equivalent: a Jest unit test of an entity.

require "test_helper"

class AccountTest < ActiveSupport::TestCase
  test "the status is active or suspended" do
    assert accounts(:active_account).active?
    assert accounts(:suspended_account).suspended?
    assert_includes Account.suspended, accounts(:suspended_account)
    assert_not_includes Account.suspended, accounts(:active_account)
  end

  test "any other status is refused" do
    assert_raises(ArgumentError) { accounts(:active_account).status = "deleted" }
  end

  test "changing the status writes the status" do
    account = accounts(:active_account)
    account.update!(status: "suspended")

    assert Account.find(account.id).suspended?
  end

  test "email, plan and signup_context cannot be changed on a saved account" do
    account = accounts(:active_account)

    assert_raises(ActiveRecord::ReadonlyAttributeError) { account.email = "other@example.com" }
    assert_raises(ActiveRecord::ReadonlyAttributeError) { account.plan = "pro" }
    assert_raises(ActiveRecord::ReadonlyAttributeError) { account.signup_context = {} }
  end

  test "MySQL fills the generated columns from signup_context" do
    account = accounts(:active_account)

    assert_equal "192.0.2.10", account.signup_ip
    assert_equal "0f1e2d3c4b5a69788796a5b4c3d2e1f0", account.signup_fingerprint
  end
end
