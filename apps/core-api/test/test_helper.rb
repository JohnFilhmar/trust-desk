# What: the setup every test file loads first.
# Convention: each test starts with `require "test_helper"`. Rails puts this
#   file in test/ and the test runner adds test/ to the load path.
# Closest equivalent: a Jest setup file listed in setupFilesAfterEnv.

# `||=` assigns only when the left side is nil or false.
ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    # A generated app runs tests on one worker per processor, and Rails then
    # creates one database per worker. One worker keeps a single test
    # database, which is enough for a suite this size.
    parallelize(workers: 1)

    # Loads every YAML file in test/fixtures/ into the test database before
    # each test, inside a transaction that is rolled back afterwards.
    fixtures :all
  end
end
