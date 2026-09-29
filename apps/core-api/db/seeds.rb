# What: fills the database with the demo data. It empties every table
#   first, so the same command also resets the demo.
# Convention: `bin/rails db:seed` runs db/seeds.rb with the whole app loaded.
#   `bin/rails db:prepare` runs it too, but only when it has just created
#   the database.
# Closest equivalent: a Prisma seed script, a Django management command
#   that loads fixtures.
#
# It must run as the admin database user, because it truncates tables.
#
# Every run gives the same accounts, the same ids and the same clusters. All
# randomness comes from one generator with a fixed seed. Only the dates
# move: they are counted back from the moment the seed runs.
#
# The work is split over the files in db/seeds/:
#   reset.rb            - empties the tables
#   demo_staff_users.rb - the three staff users
#   synthetic.rb        - IP ranges, word lists, the values clusters share
#   clock.rb            - turns "days ago" into a date
#   account_plan.rb     - which accounts exist
#   event_plan.rb       - what each account did
#   daily_stats_plan.rb - the counts per day, with gaps left on purpose
#   enforcement_plan.rb - which accounts the enforcer already acted on
#   summary.rb          - what is printed at the end

# require_relative loads a file by its path from this file. Rails does not
# autoload db/, so each file is named here.
require_relative "seeds/reset"
require_relative "seeds/demo_staff_users"
require_relative "seeds/synthetic"
require_relative "seeds/clock"
require_relative "seeds/account_plan"
require_relative "seeds/event_plan"
require_relative "seeds/daily_stats_plan"
require_relative "seeds/enforcement_plan"
require_relative "seeds/summary"

BATCH_SIZE = 1_000

started_at = Time.current
clock = Seeds::Clock.new(started_at)
# The same seed gives the same sequence of numbers on every run.
rng = Random.new(20260930)

# 1. The plans. Nothing is written yet.
account_plan = Seeds::AccountPlan.new(rng)
accounts = account_plan.build
events = Seeds::EventPlan.new(rng, accounts, account_plan.spare_ips).build
stats = Seeds::DailyStatsPlan.new(accounts, events).build
enforcement = Seeds::EnforcementPlan.new(rng, accounts).build

# A fingerprint of everything planned. The plans hold no date, so two runs
# print the same digest exactly when they planned the same data.
planned = JSON.generate([ accounts, events, stats, enforcement ])
digest = OpenSSL::Digest::SHA256.hexdigest(planned).first(16)

# 2. Empty the tables.
Seeds::Reset.truncate_all!

# 3. Write. insert_all! sends one INSERT for many rows. It skips the
# validations and the callbacks of the model, which is why the plans above
# only produce values the models would accept.
Seeds::DemoStaffUsers.create!
enforcer_id = Seeds::DemoStaffUsers::USERS.index { |user| user[:group_name] == "enforcer" } + 1

# index_by builds a hash from the account id to the action on that account,
# so the row of an account can be written with the state the action left.
action_for = enforcement.index_by { |action| action[:account_id] }

account_rows = accounts.map do |account|
  created_at = clock.at(account[:days_ago], account[:fraction])
  # nil for an account that was never acted on. `&.` and `&&` then give nil
  # too, and nil counts as false.
  action = action_for[account[:id]]
  acted_at = action && clock.at(action[:days_ago], action[:fraction])
  suspended = action&.fetch(:action_type) == "suspend"
  marked = action&.fetch(:action_type) == "mark_spam"

  {
    id: account[:id],
    email: account[:email],
    status: suspended ? "suspended" : "active",
    spam_marked_at: marked ? acted_at : nil,
    plan: account[:plan],
    signup_context: account[:signup_context],
    created_at: created_at,
    # `a || b` gives b when a is nil, which it is for an account that was
    # never acted on.
    updated_at: acted_at || created_at
  }
end
Account.insert_all!(account_rows)

# each_slice cuts the list into pieces of at most BATCH_SIZE.
events.each_slice(BATCH_SIZE) do |batch|
  rows = batch.map do |event|
    {
      account_id: event[:account_id],
      event_type: event[:event_type],
      occurred_at: clock.at(event[:days_ago], event[:fraction]),
      payload: event[:payload]
    }
  end
  Event.insert_all!(rows)
end

stats.each_slice(BATCH_SIZE) do |batch|
  rows = batch.map do |stat|
    computed_at =
      if stat[:computed_fraction]
        clock.at(stat[:days_ago], stat[:computed_fraction])
      else
        clock.computed_after(stat[:days_ago])
      end

    # merge adds the eight counter columns to the other three.
    {
      account_id: stat[:account_id],
      day: clock.date(stat[:days_ago]),
      computed_at: computed_at
    }.merge(stat[:counts])
  end
  AccountDailyStat.insert_all!(rows)
end

# The enforcement actions and their audit rows go through the models, one by
# one, so the validations run. There are a dozen of them. The details of the
# audit row have the shape app/services/account_enforcement.rb writes.
enforcement.each do |action|
  acted_at = clock.at(action[:days_ago], action[:fraction])
  suspended = action[:action_type] == "suspend"

  enforcement_action = EnforcementAction.create!(
    account_id: action[:account_id],
    staff_user_id: enforcer_id,
    action_type: action[:action_type],
    reason: action[:reason],
    correlation_id: action[:correlation_id],
    created_at: acted_at
  )
  AuditLog.create!(
    account_id: action[:account_id],
    staff_user_id: enforcer_id,
    action: "account.#{action[:action_type]}",
    correlation_id: action[:correlation_id],
    created_at: acted_at,
    details: {
      "enforcement_action_id" => enforcement_action.id,
      "action_type" => action[:action_type],
      "previous_status" => "active",
      "new_status" => suspended ? "suspended" : "active",
      "reason" => action[:reason]
    }
  )
end

OperationalMode.create!(
  mode: "normal",
  reason: "The demo starts in normal mode.",
  staff_user_id: enforcer_id,
  created_at: started_at
)

# 4. Report.
Seeds::Summary.print(accounts, enforcement, digest: digest, seconds: Time.current - started_at)
