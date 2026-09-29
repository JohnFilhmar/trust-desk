# What: one row of the raw event log, one thing an account did.
# Convention: a class in app/models/ maps to the table named after it in the
#   plural, here events.
# Closest equivalent: a TypeORM entity in NestJS, a Django model.
#
# The kind of event is in the column event_type. A column named `type` would
# switch on single-table inheritance: Rails would read each value as the name
# of a class to load.
#
# The runtime database user holds no privilege on this table. The seed writes
# events as the admin user, and the handlers read them.

class Event < ApplicationRecord
  EVENT_TYPES = %w[
    signup login login_failed payment payment_failed
    deploy cpu_spike abuse_report api_burst
  ].freeze

  # `belongs_to` adds `event.account` and makes account_id required.
  belongs_to :account

  validates :event_type, presence: true, inclusion: { in: EVENT_TYPES }
  validates :occurred_at, presence: true
end
