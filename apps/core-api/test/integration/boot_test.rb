# What: proves the app boots, routes a request and reaches MySQL.
# Convention: files in test/integration/ inherit from
#   ActionDispatch::IntegrationTest, which sends real HTTP requests through
#   the whole Rails stack, routing and middleware included.
# Closest equivalent: a supertest e2e test in NestJS or Express.

require "test_helper"

class BootTest < ActionDispatch::IntegrationTest
  # `test "..." do ... end` defines a method named after the sentence.
  # Minitest runs every method whose name starts with `test_`.
  test "the health check answers 200" do
    get "/up"

    # :success is a symbol that stands for any 2xx status.
    assert_response :success
  end

  test "the database answers and runs in UTC" do
    connection = ActiveRecord::Base.connection

    assert_equal 1, connection.select_value("SELECT 1")
    assert_equal "+00:00", connection.select_value("SELECT @@session.time_zone")
  end

  test "an unknown path answers 404, not an error page" do
    get "/nope"

    assert_response :not_found
  end
end
