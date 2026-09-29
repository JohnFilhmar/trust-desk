# What: decides which events each account has, from its signup to today.
# Convention: none. db/seeds.rb loads this file with require_relative.
# Closest equivalent: a factory module of a TypeScript seed script.
#
# Like the account plan, this touches no database and holds no date. Each
# event is a hash with the account id, the event type, a number of days ago,
# a fraction of that day and the payload.
#
# What makes an account look abusive is how often each event type happens.
# DAILY_RATES holds that, one line per profile.

module Seeds
  class EventPlan
    # How often an event type happens on one day.
    #   a number from 0 to 1 - the chance of one event that day
    #   a range such as 6..14 - that many events, drawn anew for each day
    QUIET = {
      "login" => 0.35,
      "login_failed" => 0.04,
      "deploy" => 0.12,
      "api_burst" => 0.02,
      "cpu_spike" => 0.01,
      "payment_failed" => 0.005
    }.freeze

    # `merge` returns a copy of QUIET with some values replaced.
    DAILY_RATES = {
      clean: QUIET,
      fingerprint_ring: QUIET,
      signup_burst: QUIET,
      disposable: QUIET,
      stats_gap: QUIET,
      stats_stale: QUIET,
      # Crypto mining: a few deploys, then the CPU pinned all day.
      miner: QUIET.merge("deploy" => 1..3, "cpu_spike" => 6..14).freeze,
      # Card testing: many cards tried, few accepted.
      card_tester: QUIET.merge("payment_failed" => 3..6, "payment" => 0.3).freeze,
      # Phishing: the site is deployed often. The reports come in one burst,
      # see add_abuse_burst.
      phisher: QUIET.merge("deploy" => 0.5).freeze
    }.freeze

    # What the accounts with incomplete stats do on each of the two newest
    # days, so those days have something to count.
    RECENT_ACTIVITY = %w[login login deploy api_burst].freeze
    RECENT_DAYS = [ 1, 0 ].freeze

    # The phishing reports arrive this many days ago, inside three hours
    # that start at this fraction of the day.
    ABUSE_BURST_DAYS_AGO = 1
    ABUSE_BURST_STARTS_AT = 0.4
    THREE_HOURS = 3.0 / 24

    PAYMENT_FAILURES = %w[card_declined insufficient_funds expired_card].freeze
    API_ENDPOINTS = %w[/v1/deployments /v1/projects /v1/logs].freeze
    PHISHING_SUMMARIES = [
      "Phishing page that copies a bank sign-in form.",
      "Reported as phishing: the page asks for card details.",
      "Phishing kit hosted under this account, reported by a visitor."
    ].freeze

    def initialize(rng, accounts, spare_ips)
      @rng = rng
      @accounts = accounts
      @spare_ips = spare_ips
      @events = []
      @deploys = 0
    end

    # Returns the events, oldest first.
    def build
      @accounts.each { |account| add_events_for(account) }

      @events.sort_by do |event|
        [ -event[:days_ago], event[:fraction], event[:account_id] ]
      end
    end

    private

    def add_events_for(account)
      add(account, "signup", account[:days_ago], account[:fraction])
      add_first_payment(account)

      # downto counts down: from the day of the signup to 0, which is today.
      account[:days_ago].downto(0) do |days_ago|
        DAILY_RATES.fetch(account[:profile]).each do |event_type, rate|
          times(rate).times { add(account, event_type, days_ago) }
        end
      end

      add_abuse_burst(account) if account[:profile] == :phisher
      add_recent_activity(account) if %i[stats_gap stats_stale].include?(account[:profile])
    end

    # A paid plan is paid for on the day of the signup. A card tester never
    # gets that far.
    def add_first_payment(account)
      return if account[:profile] == :card_tester
      return unless Synthetic::PAID_PLAN_PRICES.key?(account[:plan])

      add(account, "payment", account[:days_ago])
    end

    def add_abuse_burst(account)
      @rng.rand(6..10).times do
        fraction = ABUSE_BURST_STARTS_AT + (@rng.rand * THREE_HOURS)
        add(account, "abuse_report", ABUSE_BURST_DAYS_AGO, fraction)
      end
    end

    def add_recent_activity(account)
      RECENT_DAYS.each do |days_ago|
        RECENT_ACTIVITY.each { |event_type| add(account, event_type, days_ago) }
      end
    end

    def times(rate)
      # rand with a range returns a whole number inside it.
      return @rng.rand(rate) if rate.is_a?(Range)

      # rand with no argument returns a number from 0 up to 1.
      @rng.rand < rate ? 1 : 0
    end

    def add(account, event_type, days_ago, fraction = nil)
      @events << {
        account_id: account[:id],
        event_type: event_type,
        days_ago: days_ago,
        fraction: fraction || fraction_on(account, days_ago),
        payload: payload_for(event_type, account)
      }
    end

    # On the day of the signup, an event comes after the signup. On any
    # later day it can come at any time.
    def fraction_on(account, days_ago)
      return @rng.rand unless days_ago == account[:days_ago]

      account[:fraction] + (@rng.rand * (1.0 - account[:fraction]))
    end

    # Every payload is a JSON object. Only signup and login events carry an
    # IP, and no payload carries an email.
    def payload_for(event_type, account)
      case event_type
      when "signup"
        { "ip" => account[:signup_context].fetch("ip"), "method" => "email" }
      when "login"
        { "ip" => login_ip(account), "method" => "password" }
      when "login_failed"
        { "ip" => login_ip(account), "failure" => "bad_password" }
      when "payment"
        { "amount_cents" => amount_cents(account), "currency" => "USD" }
      when "payment_failed"
        {
          "amount_cents" => amount_cents(account),
          "currency" => "USD",
          "failure_code" => Synthetic.pick(PAYMENT_FAILURES, @rng)
        }
      when "deploy" then deploy_payload(account)
      when "cpu_spike" then cpu_spike_payload(account)
      when "abuse_report"
        {
          "category" => "phishing",
          "source" => "external_report",
          "summary" => Synthetic.pick(PHISHING_SUMMARIES, @rng),
          "reported_url" => "https://account-#{account[:id]}.example.org/sign-in"
        }
      when "api_burst"
        {
          "requests_per_minute" => @rng.rand(900..4000),
          "endpoint" => Synthetic.pick(API_ENDPOINTS, @rng)
        }
      end
    end

    # Most logins come from the IP of the signup. About one in seven comes
    # from an IP no account signed up from.
    def login_ip(account)
      return Synthetic.pick(@spare_ips, @rng) if @rng.rand < 0.15

      account[:signup_context].fetch("ip")
    end

    def amount_cents(account)
      Synthetic::PAID_PLAN_PRICES.fetch(account[:plan], 1900)
    end

    def deploy_payload(account)
      @deploys += 1
      payload = {
        "deploy_id" => format("dep_%06d", @deploys),
        "region" => Synthetic.pick(Synthetic::REGIONS, @rng),
        "build_seconds" => @rng.rand(20..240)
      }
      payload["entrypoint"] = "xmrig" if account[:profile] == :miner
      payload
    end

    # A miner holds the CPU near 100 percent for hours. Anyone else has a
    # short spike.
    def cpu_spike_payload(account)
      mining = account[:profile] == :miner

      {
        "cpu_percent" => mining ? @rng.rand(96..100) : @rng.rand(70..90),
        "duration_seconds" => mining ? @rng.rand(3600..14_400) : @rng.rand(60..600),
        "region" => Synthetic.pick(Synthetic::REGIONS, @rng)
      }
    end
  end
end
