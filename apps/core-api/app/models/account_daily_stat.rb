# What: the event counts of one account on one UTC day.
# Convention: Rails turns the class name AccountDailyStat into the table name
#   account_daily_stats. Only the last word is made plural.
# Closest equivalent: a TypeORM entity in NestJS, a Django model.
#
# The table stores counts and never a risk score. The score is computed in
# one place, a TypeScript function in the handlers.
#
# The runtime database user holds no privilege on this table. The seed writes
# it as the admin user, and the handlers read it.

class AccountDailyStat < ApplicationRecord
  # Which counter column counts which event type. A signup has no counter.
  COUNTER_FOR_EVENT_TYPE = {
    "login" => "logins_count",
    "login_failed" => "failed_logins_count",
    "payment" => "payments_count",
    "payment_failed" => "failed_payments_count",
    "deploy" => "deploys_count",
    "cpu_spike" => "cpu_spikes_count",
    "abuse_report" => "abuse_reports_count",
    "api_burst" => "api_bursts_count"
  }.freeze

  belongs_to :account

  validates :day, presence: true
  validates :computed_at, presence: true
end
