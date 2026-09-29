# What: counts the planned events into one row per account per UTC day, and
#   leaves some rows missing or stale on purpose.
# Convention: none. db/seeds.rb loads this file with require_relative.
# Closest equivalent: the nightly aggregation job of a real platform, run
#   once over the seed data.
#
# The handlers read account_daily_stats first and fall back to counting raw
# events when a day is missing or stale. This is the log-platform fallback.
# It needs days to fall back on, so:
#   - accounts with the profile stats_gap get no row for today and yesterday
#   - accounts with the profile stats_stale get a row for yesterday that was
#     computed halfway through the day, so it misses the later events

module Seeds
  class DailyStatsPlan
    GAP_DAYS = [ 0, 1 ].freeze
    STALE_DAY = 1

    def initialize(accounts, events)
      @profiles = accounts.to_h { |account| [ account[:id], account[:profile] ] }
      @events = events
    end

    # Returns one hash per row. `computed_fraction` is nil for a row that
    # was computed after its day ended.
    def build
      # group_by returns a hash from each distinct key to the events that
      # share it. Here the key is the pair of account and day.
      by_account_and_day = @events.group_by do |event|
        [ event[:account_id], event[:days_ago] ]
      end

      # filter_map keeps what the block returns and drops every nil.
      # `(account_id, days_ago)` takes the pair apart.
      by_account_and_day.filter_map do |(account_id, days_ago), day_events|
        profile = @profiles.fetch(account_id)
        # `next` leaves the block early. With no value it returns nil.
        next if profile == :stats_gap && GAP_DAYS.include?(days_ago)

        if profile == :stats_stale && days_ago == STALE_DAY
          stale_row(account_id, days_ago, day_events)
        else
          row(account_id, days_ago, day_events, nil)
        end
      end
    end

    private

    # Counts the first half of the day's events and stops the clock at the
    # last one counted. Every later event is newer than computed_at, which
    # is what makes the row stale.
    def stale_row(account_id, days_ago, day_events)
      in_order = day_events.sort_by { |event| event[:fraction] }
      counted = in_order.first(in_order.size / 2)

      row(account_id, days_ago, counted, counted.last[:fraction])
    end

    def row(account_id, days_ago, counted_events, computed_fraction)
      # Starts every counter at 0. `values` lists the eight column names.
      counts = AccountDailyStat::COUNTER_FOR_EVENT_TYPE.values.to_h { |column| [ column, 0 ] }

      counted_events.each do |event|
        column = AccountDailyStat::COUNTER_FOR_EVENT_TYPE[event[:event_type]]
        # A signup has no counter, so column is nil for it.
        counts[column] += 1 if column
      end

      {
        account_id: account_id,
        days_ago: days_ago,
        counts: counts,
        computed_fraction: computed_fraction
      }
    end
  end
end
