# What: prints what the seed wrote: the row counts, one account per cluster,
#   and the accounts whose daily stats are incomplete.
# Convention: none. db/seeds.rb loads this file with require_relative.
# Closest equivalent: the console output at the end of a TypeScript seed
#   script.
#
# The demo script and the tests of the handlers name accounts from this
# output. Everything printed is synthetic.

module Seeds
  module Summary
    MODELS = [
      StaffUser, Account, Event, AccountDailyStat,
      EnforcementAction, AuditLog, OperationalMode, SignedRequestNonce
    ].freeze

    CLUSTER_LABELS = {
      fingerprint_ring: "one device fingerprint",
      signup_burst: "signups from one IP inside one hour",
      miner: "crypto mining: cpu_spike and deploy events",
      phisher: "a burst of abuse_report events about phishing",
      card_tester: "a high rate of payment_failed events",
      disposable: "disposable email domain"
    }.freeze

    module_function

    def print(accounts, digest:, seconds:)
      puts "Seed finished in #{seconds.round(1)} seconds. Data digest: #{digest}"
      puts
      puts "Rows per table"
      MODELS.each do |model|
        # ljust pads the text with spaces up to the given width.
        puts "  #{model.table_name.ljust(24)} #{model.count}"
      end
      puts
      puts "Staff users"
      DemoStaffUsers::USERS.each_with_index do |user, index|
        puts "  id #{index + 1}  #{user[:email]}  (#{user[:group_name]})"
      end
      puts
      print_clusters(accounts)
      puts
      print_incomplete_stats(accounts)
    end

    def print_clusters(accounts)
      # group_by returns a hash from each profile to its accounts.
      by_profile = accounts.group_by { |account| account[:profile] }

      puts "Clusters, with the first account of each"
      CLUSTER_LABELS.each do |profile, label|
        members = by_profile.fetch(profile).sort_by { |account| account[:email] }
        first = members.first
        puts "  #{label} (#{members.size} accounts)"
        puts "    id #{first[:id]}  #{first[:email]}"
        puts "    all ids: #{ids_of(members)}"
      end
      puts "  the shared fingerprint: #{Synthetic::SHARED_FINGERPRINT}"
      puts "  the IP of the signup burst: #{Synthetic::BURST_IP}"
    end

    def print_incomplete_stats(accounts)
      gap = accounts.select { |account| account[:profile] == :stats_gap }
      stale = accounts.select { |account| account[:profile] == :stats_stale }

      puts "Accounts with no account_daily_stats row for today and yesterday"
      puts "  emails stats-gap-01@example.com to stats-gap-#{gap.size}@example.com"
      puts "  ids: #{ids_of(gap)}"
      puts "Accounts whose row for yesterday is stale"
      puts "  emails stats-stale-01@example.com to stats-stale-#{stale.size}@example.com"
      puts "  ids: #{ids_of(stale)}"
    end

    def ids_of(accounts)
      accounts.map { |account| account[:id] }.sort.join(", ")
    end
  end
end
