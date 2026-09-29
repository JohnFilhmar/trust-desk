# What: tests for the class that stores and repeats answers, without HTTP.
# Convention: tests for app/services/idempotent_request.rb go in
#   test/services/idempotent_request_test.rb.
# Closest equivalent: a Jest unit test of an idempotency interceptor.
#
# Two requests at the same moment cannot be staged inside one test, because
# a test has one database connection. So the moment is imitated: a child
# class makes the first lookup find nothing, as it would when the twin
# request has not committed yet, and the real lookup takes over after that.

require "test_helper"

class IdempotentRequestTest < ActiveSupport::TestCase
  KEY = "7d9f0a52-3c1b-4e8a-9f60-2b4c6d8e0a1c"
  PATH = "POST /internal/accounts/42/suspend"
  REASON = "Twelve accounts share this fingerprint."

  class BlindOnFirstLookup < IdempotentRequest
    private

    def find_stored
      # `to_i` turns nil into 0, so the count starts by itself.
      @lookups = @lookups.to_i + 1
      return nil if @lookups == 1

      # `super` calls the method of the parent class.
      super
    end
  end

  test "with no key the action runs and nothing is stored" do
    runs = 0

    assert_no_difference "IdempotencyKey.count" do
      answer = request_for(key: nil).run do
        runs += 1
        fresh_answer
      end

      assert_equal 201, answer.status
      assert_not answer.repeated
    end
    assert_equal 1, runs
  end

  test "a new key runs the action and stores the answer" do
    answer = nil

    assert_difference "IdempotencyKey.count", 1 do
      answer = request_for.run { fresh_answer }
    end

    assert_not answer.repeated
    stored = IdempotencyKey.find_by!(key: KEY)
    assert_equal PATH, stored.request_path
    assert_equal 201, stored.response_status
    assert_equal({ "audit_log_id" => 1 }, stored.response_body)
    assert_equal staff_users(:enforcer).id, stored.staff_user_id
  end

  test "a stored key returns the stored answer and does not run the action" do
    request_for.run { fresh_answer }
    runs = 0

    answer = request_for.run do
      runs += 1
      fresh_answer
    end

    assert_equal 0, runs
    assert answer.repeated
    assert_equal 201, answer.status
    assert_equal({ "audit_log_id" => 1 }, answer.body)
  end

  test "the order of the keys in the payload does not change the hash" do
    request_for(payload: { "actor_staff_user_id" => 3, "reason" => REASON }).run { fresh_answer }

    answer = request_for(payload: { "reason" => REASON, "actor_staff_user_id" => 3 }).run { flunk }

    assert answer.repeated
  end

  test "the hash is the SHA-256 of the payload with its keys in order" do
    request_for(payload: { "reason" => REASON, "actor_staff_user_id" => 3 }).run { fresh_answer }

    canonical = %({"actor_staff_user_id":3,"reason":"#{REASON}"})
    assert_equal OpenSSL::Digest::SHA256.hexdigest(canonical), IdempotencyKey.find_by!(key: KEY).request_hash
  end

  test "a stored key with another payload or another path is refused" do
    request_for.run { fresh_answer }

    assert_raises(IdempotentRequest::KeyReused) do
      request_for(payload: { "actor_staff_user_id" => 3, "reason" => "Another reason entirely." }).run { flunk }
    end
    assert_raises(IdempotentRequest::KeyReused) do
      request_for(request_path: "POST /internal/accounts/43/suspend").run { flunk }
    end
  end

  test "a key that is not a UUID is refused before the action runs" do
    [ "not-a-uuid", "", 12_345, [ KEY ] ].each do |bad_key|
      assert_raises(IdempotentRequest::InvalidKey) { request_for(key: bad_key).run { flunk } }
    end
  end

  test "an action that raises stores nothing, so the key can be sent again" do
    assert_no_difference "IdempotencyKey.count" do
      assert_raises(SuspendAccount::AlreadySuspended) do
        request_for.run { raise SuspendAccount::AlreadySuspended }
      end
    end

    assert_difference "IdempotencyKey.count", 1 do
      request_for.run { fresh_answer }
    end
  end

  test "what the action wrote is rolled back when the answer cannot be stored" do
    assert_no_difference [ "OperationalMode.count", "IdempotencyKey.count" ] do
      assert_raises(ActiveRecord::RecordInvalid) do
        # No staff user, so the row of idempotency_keys is refused.
        request_for(staff_user: nil).run do
          OperationalMode.create!(mode: "elevated", reason: "Written by the action.", staff_user: staff_users(:enforcer))
          fresh_answer
        end
      end
    end
  end

  test "two at once, the insert loses: the unique index refuses it and the stored answer is returned" do
    store_answer_of_the_twin

    assert_no_difference [ "OperationalMode.count", "IdempotencyKey.count" ] do
      answer = blind_request.run do
        # This write stands for the action. It must be rolled back.
        OperationalMode.create!(mode: "elevated", reason: "Written by the loser.", staff_user: staff_users(:enforcer))
        fresh_answer(audit_log_id: 2)
      end

      assert answer.repeated
      assert_equal({ "audit_log_id" => 1 }, answer.body)
    end
  end

  test "two at once, the action is refused: the stored answer is returned" do
    store_answer_of_the_twin

    answer = blind_request.run { raise SuspendAccount::AlreadySuspended }

    assert answer.repeated
    assert_equal({ "audit_log_id" => 1 }, answer.body)
  end

  test "two at once with different bodies: the loser is told the key was reused" do
    store_answer_of_the_twin

    assert_raises(IdempotentRequest::KeyReused) do
      blind_request(payload: { "actor_staff_user_id" => 3, "reason" => "Another reason entirely." })
        .run { raise SuspendAccount::AlreadySuspended }
    end
  end

  private

  def request_for(key: KEY, staff_user: staff_users(:enforcer), request_path: PATH, payload: default_payload)
    IdempotentRequest.new(key: key, staff_user: staff_user, request_path: request_path, payload: payload)
  end

  def blind_request(payload: default_payload)
    BlindOnFirstLookup.new(
      key: KEY, staff_user: staff_users(:enforcer), request_path: PATH, payload: payload
    )
  end

  def default_payload
    { "actor_staff_user_id" => 3, "reason" => REASON }
  end

  def fresh_answer(audit_log_id: 1)
    IdempotentRequest::Response.new(status: 201, body: { "audit_log_id" => audit_log_id }, repeated: false)
  end

  def store_answer_of_the_twin
    request_for.run { fresh_answer }
  end
end
