# What: the stored answer to one enforcement request, found again by the key
#   the browser sent with it.
# Convention: a class in app/models/ maps to the table named after it in the
#   plural. Rails knows that the plural of key is keys, so IdempotencyKey
#   maps to idempotency_keys.
# Closest equivalent: a Redis entry keyed by the Idempotency-Key header,
#   held in MySQL.
#
# A row is written once, in the same transaction as the action it answers,
# and never changed. The runtime database user holds SELECT and INSERT on
# this table and nothing else.
#
# There is no uniqueness validation on purpose. It would run a SELECT before
# the INSERT, and two requests arriving together would both find nothing.
# The unique index on `key` is what lets one insert through. See
# app/services/idempotent_request.rb.

class IdempotencyKey < ApplicationRecord
  belongs_to :staff_user

  validates :key, presence: true
  validates :request_path, presence: true
  validates :request_hash, presence: true
  validates :response_status, presence: true

  # Same technique as AuditLog: a saved row cannot be updated or destroyed
  # from Ruby.
  def readonly?
    persisted?
  end
end
