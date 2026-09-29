# What: decides which accounts the seed creates: the clean ones, one cluster
#   per abuse pattern, and the accounts whose daily stats are left incomplete.
# Convention: none. db/seeds.rb loads this file with require_relative.
# Closest equivalent: a factory module of a TypeScript seed script.
#
# The plan touches no database and holds no date, so a test can build it and
# read it. Each account is a hash with a `profile`, which tells the event
# plan how that account behaves.
#
# The cluster accounts have emails that are easy to say in a demo, such as
# ring-01@example.com.

module Seeds
  class AccountPlan
    TOTAL = 300

    # How many accounts each cluster holds.
    SIZES = {
      fingerprint_ring: 12,
      signup_burst: 15,
      miner: 6,
      phisher: 5,
      card_tester: 8,
      disposable: 6,
      stats_gap: 20,
      stats_stale: 10
    }.freeze

    # The signup burst happens this many days ago, inside one hour that
    # starts at this fraction of the day.
    BURST_DAYS_AGO = 4
    BURST_STARTS_AT = 0.55
    ONE_HOUR = 1.0 / 24

    # The IPs no account signed up from. Logins from a second IP use them.
    attr_reader :spare_ips

    def initialize(rng)
      @rng = rng
      @spare_ips = Synthetic.ip_pool(rng)
      @accounts = []
    end

    # Returns the accounts, oldest first, numbered from 1.
    def build
      add_fingerprint_ring
      add_signup_burst
      add_cluster(:miner, "miner", "example.com", 4..12)
      add_cluster(:phisher, "phish", "example.org", 6..15)
      add_cluster(:card_tester, "cardtest", "example.com", 3..10, plan: "pro")
      add_disposable
      add_cluster(:stats_gap, "stats-gap", "example.com", 6..25)
      add_cluster(:stats_stale, "stats-stale", "example.com", 6..25)
      add_clean(TOTAL - @accounts.size)

      number_by_age
    end

    private

    # 12 accounts, each from its own IP, all with one device fingerprint.
    def add_fingerprint_ring
      SIZES.fetch(:fingerprint_ring).times do |index|
        add(
          profile: :fingerprint_ring,
          email: "ring-#{two_digits(index + 1)}@example.com",
          days_ago: @rng.rand(2..9),
          plan: "free",
          fingerprint: Synthetic::SHARED_FINGERPRINT
        )
      end
    end

    # 15 accounts from one IP inside one hour, each with its own fingerprint.
    def add_signup_burst
      SIZES.fetch(:signup_burst).times do |index|
        add(
          profile: :signup_burst,
          email: "burst-#{two_digits(index + 1)}@example.org",
          days_ago: BURST_DAYS_AGO,
          fraction: BURST_STARTS_AT + (@rng.rand * ONE_HOUR),
          plan: "free",
          ip: Synthetic::BURST_IP
        )
      end
    end

    def add_disposable
      SIZES.fetch(:disposable).times do |index|
        # `%` is the remainder, so the index walks through the domains and
        # starts again at the first.
        domain = Synthetic::DISPOSABLE_DOMAINS[index % Synthetic::DISPOSABLE_DOMAINS.size]
        add(
          profile: :disposable,
          email: "drop-#{two_digits(index + 1)}@#{domain}",
          days_ago: @rng.rand(1..14),
          plan: "free"
        )
      end
    end

    # `plan: nil` is a keyword argument with a default. A caller may leave
    # it out.
    def add_cluster(profile, name, domain, age_range, plan: nil)
      SIZES.fetch(profile).times do |index|
        add(
          profile: profile,
          email: "#{name}-#{two_digits(index + 1)}@#{domain}",
          days_ago: @rng.rand(age_range),
          plan: plan
        )
      end
    end

    def add_clean(count)
      count.times do |index|
        first = Synthetic.pick(Synthetic::FIRST_NAMES, @rng)
        last = Synthetic.pick(Synthetic::LAST_NAMES, @rng)
        domain = Synthetic.pick(Synthetic::EMAIL_DOMAINS, @rng)
        # The number makes the email unique when two accounts draw one name.
        add(
          profile: :clean,
          email: "#{first}.#{last}#{index + 1}@#{domain}",
          days_ago: @rng.rand(0..29)
        )
      end
    end

    # Every value that was not given is drawn from the seeded generator.
    # `a || b` gives b when a is nil.
    def add(profile:, email:, days_ago:, fraction: nil, plan: nil, ip: nil, fingerprint: nil)
      @accounts << {
        profile: profile,
        email: email,
        plan: plan || Synthetic.pick(Synthetic::PLANS, @rng),
        days_ago: days_ago,
        fraction: fraction || @rng.rand,
        signup_context: {
          # `shift` takes the first IP out of the list, so no two accounts
          # get the same one.
          "ip" => ip || @spare_ips.shift,
          "country" => Synthetic.pick(Synthetic::COUNTRIES, @rng),
          "user_agent" => Synthetic.pick(Synthetic::USER_AGENTS, @rng),
          "device_fingerprint" => fingerprint || Synthetic.fingerprint(@rng),
          "referral" => Synthetic.pick(Synthetic::REFERRALS, @rng)
        }
      }
    end

    # Oldest first, so a higher id means a newer account, as in a real
    # table. The email settles a tie.
    def number_by_age
      sorted = @accounts.sort_by do |account|
        [ -account[:days_ago], account[:fraction], account[:email] ]
      end

      sorted.each_with_index { |account, index| account[:id] = index + 1 }
    end

    def two_digits(number)
      format("%02d", number)
    end
  end
end
