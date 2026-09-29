# What: the setup every test file loads first.
# Convention: each test starts with `require "test_helper"`. Rails puts this
#   file in test/ and the test runner adds test/ to the load path.
# Closest equivalent: a Jest setup file listed in setupFilesAfterEnv.

# `||=` assigns only when the left side is nil or false.
ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

# Loads every helper in test/support/. Dir[] lists the files that match the
# pattern, and `sort` makes the order the same on every machine.
Dir[Rails.root.join("test/support/**/*.rb")].sort.each { |file| require file }

module ActiveSupport
  class TestCase
    # A generated app runs tests on one worker per processor, and Rails then
    # creates one database per worker. One worker keeps a single test
    # database, which is enough for a suite this size.
    parallelize(workers: 1)

    # Loads every YAML file in test/fixtures/ into the test database before
    # each test, inside a transaction that is rolled back afterwards.
    fixtures :all

    # Reads one of the JSON fixtures that the TypeScript tests read too. They
    # live in packages/shared/fixtures, which the container mounts at the
    # path in SHARED_FIXTURES_DIR.
    #
    # The leading `::` means the top-level JSON module. Without it Ruby
    # would find ActiveSupport::JSON first, because this code sits inside
    # the module ActiveSupport.
    def shared_fixture(name)
      ::JSON.parse(File.read(File.join(ENV.fetch("SHARED_FIXTURES_DIR"), name)))
    end
  end
end

module ActionDispatch
  class IntegrationTest
    # Adds signed_post and assert_error_envelope to every request test.
    include SignedRequestHelper
    # Adds capture_log.
    include LogCaptureHelper
  end
end
