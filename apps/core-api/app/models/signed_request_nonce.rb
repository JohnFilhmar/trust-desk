# What: the memory of which signed requests were already seen, so a captured
#   request cannot be sent a second time.
# Convention: a class in app/models/ maps to the table named after it in the
#   plural, here signed_request_nonces.
# Closest equivalent: a Redis SET with NX and an expiry, held in MySQL. See
#   docs/decisions/004-nonce-store.md.

class SignedRequestNonce < ApplicationRecord
  # A timestamp is accepted up to 60 seconds either side of now, so a nonce
  # can matter for 120 seconds at most. After that the timestamp check
  # refuses the request before the nonce is looked at.
  RETENTION_SECONDS = 120

  # Stores the nonce. Returns true when it is new and false when it was
  # already there.
  #
  # The insert is the check. There is no SELECT first, because two requests
  # arriving together would both find nothing and both carry on. The unique
  # index lets one insert through and fails the other.
  def self.remember(nonce, now: Time.current)
    create!(nonce: nonce, seen_at: now)
    true
  # A `rescue` at the end of a method catches what the method body raised.
  rescue ActiveRecord::RecordNotUnique
    false
  end

  # Deletes the rows too old to matter. `delete_all` sends one DELETE
  # statement and loads no records. A range written `...x` has no start, so
  # it means everything before x.
  def self.forget_expired(now: Time.current)
    where(seen_at: ...(now - RETENTION_SECONDS)).delete_all
  end
end
