# What: decides which accounts the demo enforcer has already acted on, so
#   the console has suspended accounts and an audit trail on first load.
# Convention: none. db/seeds.rb loads this file with require_relative.
# Closest equivalent: a factory module of a TypeScript seed script.
#
# Like the other plans, this touches no database and holds no date. Each
# action is a hash with the account id, the action type, the reason, a
# number of days ago and a fraction of that day.
#
# Only cluster accounts are acted on, and the reason names the cluster, so
# the audit trail tells the same story as the data.

module Seeds
  class EnforcementPlan
    # profile, how many accounts, action type, the oldest day the action may
    # fall on, reason.
    #
    # The phishing reports arrive yesterday, see EventPlan. A mark that
    # answers them cannot be older than that, so its oldest day is 1.
    ACTIONS = [
      [ :fingerprint_ring, 3, "suspend", 2, "Shares one device fingerprint with eleven other accounts." ],
      [ :signup_burst, 2, "suspend", 2, "One of fifteen signups from a single IP inside one hour." ],
      [ :miner, 2, "suspend", 2, "Crypto mining: the CPU stays near 100 percent for hours after each deploy." ],
      [ :card_tester, 1, "suspend", 2, "Card testing: most payment attempts on this account fail." ],
      [ :phisher, 4, "mark_spam", 1, "Phishing: a burst of abuse reports names the site this account hosts." ]
    ].freeze

    # Every action falls in the last part of its day. For a phisher that is
    # after the abuse reports, which end before this fraction.
    EARLIEST_FRACTION = 0.6
    # The actions are spread over today, yesterday and the day before.
    DAYS = 3

    def initialize(rng, accounts)
      @rng = rng
      @accounts = accounts
    end

    # Returns the actions, oldest first.
    def build
      actions = []

      # The names between the bars take each row of five apart.
      ACTIONS.each do |profile, count, action_type, oldest_day, reason|
        first_accounts_of(profile, count).each do |account|
          actions << {
            account_id: account[:id],
            action_type: action_type,
            reason: reason,
            days_ago: days_ago_for(account, actions.size, oldest_day),
            fraction: EARLIEST_FRACTION + (@rng.rand * (1.0 - EARLIEST_FRACTION)),
            correlation_id: Synthetic.uuid(@rng)
          }
        end
      end

      actions.sort_by { |action| [ -action[:days_ago], action[:fraction], action[:account_id] ] }
    end

    private

    # The accounts of a cluster with the lowest numbers in their email, such
    # as ring-01, ring-02 and ring-03.
    def first_accounts_of(profile, count)
      @accounts
        .select { |account| account[:profile] == profile }
        .sort_by { |account| account[:email] }
        .first(count)
    end

    # `%` is the remainder, so the position walks through 0, 1, 2 and starts
    # again. `min` then picks the newest of three days: that one, the oldest
    # day allowed, and the day after the account was created.
    def days_ago_for(account, position, oldest_day)
      [ position % DAYS, oldest_day, account[:days_ago] - 1 ].min
    end
  end
end
