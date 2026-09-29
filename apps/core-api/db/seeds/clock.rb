# What: turns "this many days ago, this far into the day" into a moment in
#   time, relative to the moment the seed runs.
# Convention: none. Rails only knows db/seeds.rb. The files in db/seeds/ are
#   plain Ruby that db/seeds.rb loads with require_relative.
# Closest equivalent: a clock injected into a TypeScript seed script.
#
# The plans in this folder never hold a date. They hold a number of days ago
# and a fraction of the day from 0 to 1. So the same plan gives fresh dates
# on every run, and an event always lands on the same UTC day relative to
# today.

module Seeds
  class Clock
    SECONDS_PER_DAY = 86_400

    attr_reader :now, :today_start

    def initialize(now)
      @now = now.utc
      # Midnight UTC of the day the seed runs.
      @today_start = @now.beginning_of_day
    end

    # days_ago - 0 is today, 1 is yesterday
    # fraction - 0.0 is the start of that day, 1.0 is its end
    #
    # Today has not ended, so its fractions are spread over the part that has
    # passed. Nothing is ever dated in the future.
    def at(days_ago, fraction)
      seconds = days_ago.zero? ? (now - today_start) : SECONDS_PER_DAY

      (day_start(days_ago) + (fraction * seconds)).round(6)
    end

    def day_start(days_ago)
      today_start - (days_ago * SECONDS_PER_DAY)
    end

    # The UTC date of that day, for the `day` column of account_daily_stats.
    def date(days_ago)
      day_start(days_ago).to_date
    end

    # When the daily job would have computed the stats of that day: ten
    # minutes after the day ended. For today and yesterday that moment may
    # not have come yet, so it is capped at now.
    def computed_after(days_ago)
      return now if days_ago.zero?

      [ day_start(days_ago - 1) + 600, now ].min
    end
  end
end
