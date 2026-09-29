# What: request tests for what every internal controller inherits: the error
#   envelope for an unexpected exception and for an unknown path.
# Convention: tests for app/controllers/internal/base_controller.rb go in
#   test/controllers/internal/.
# Closest equivalent: a supertest e2e test of an exception filter in NestJS.

require "test_helper"

module Internal
  # A controller that exists only in this test. Its one action raises, which
  # is what a bug in a real action would do.
  class ExplodingController < BaseController
    def boom
      raise "SELECT secret_detail FROM somewhere"
    end
  end

  class BaseControllerTest < ActionDispatch::IntegrationTest
    test "an unexpected exception answers 500 with the envelope and no detail" do
      # with_routing swaps the routes for the ones drawn in the block, and
      # puts the real ones back when the block ends. The response is only
      # readable inside the block.
      with_routing do |routes|
        routes.draw do
          post "/internal/boom", to: "internal/exploding#boom"
        end

        signed_post "/internal/boom", {}

        assert_error_envelope :internal_server_error, "internal_error"
        assert_not_includes response.body, "secret_detail"
        assert_not_includes response.body, "RuntimeError"
        assert_not_includes response.body, "base_controller_test.rb"
      end
    end

    test "an unknown internal path answers 404 with the envelope" do
      signed_post "/internal/accounts/1/delete_everything", {}

      assert_error_envelope :not_found, "not_found"
    end

    test "an unknown internal path without a signature answers 401" do
      get "/internal/anything"

      assert_error_envelope :unauthorized, "invalid_signature"
    end

    test "the health check needs no signature" do
      get "/up"

      assert_response :success
    end
  end
end
