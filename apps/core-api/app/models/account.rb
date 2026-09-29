# What: a customer account under investigation.
# Convention: a class in app/models/ maps to the table named after it in the
#   plural, here accounts.
# Closest equivalent: a TypeORM entity in NestJS, a Django model.
#
# Rails changes three columns of this table at runtime: status,
# spam_marked_at and updated_at. The runtime database user is granted UPDATE
# on those three only, so an attempt to change anything else fails in MySQL.

class Account < ApplicationRecord
  # Maps the status column to named states. It adds `account.active?`,
  # `account.suspended?`, the scopes `Account.active` and `Account.suspended`,
  # and refuses any other value. The hash maps each name to the text stored
  # in the column.
  enum :status, { active: "active", suspended: "suspended" }

  # `has_many` adds `account.events`, which selects the rows of the other
  # table whose account_id is this account's id.
  has_many :events
  has_many :account_daily_stats
  has_many :enforcement_actions
  has_many :audit_logs

  # These may be set when a record is created and never afterwards. Assigning
  # one on a saved record raises ActiveRecord::ReadonlyAttributeError.
  attr_readonly :email, :plan, :signup_context
end
