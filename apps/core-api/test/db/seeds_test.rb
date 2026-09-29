# What: tests for the plans behind db/seeds.rb. They build the plans in
#   memory and never run the seed, so no table is emptied.
# Convention: the test folder mirrors the code, so tests for db/seeds/ go in
#   test/db/. Rails runs every file under test/ whose name ends in _test.rb.
# Closest equivalent: a Jest unit test of the factories behind a seed script.

require "test_helper"

# Rails does not autoload db/, so the files are loaded by path.
SEED_FILES = %w[
  synthetic clock reset demo_staff_users
  account_plan event_plan daily_stats_plan enforcement_plan
].freeze
SEED_FILES.each { |name| require Rails.root.join("db/seeds", name).to_s }

class SeedsTest < ActiveSupport::TestCase
  SEED = 20260930
  ALLOWED_IP = /\A(192\.0\.2|198\.51\.100|203\.0\.113)\.\d{1,3}\z/
  ANY_IP = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/
  ANY_EMAIL = /[\w.+-]+@[\w.-]+/

  # Built on first use and then kept for the rest of the test. Minitest makes
  # a new object for every test, so no test sees the plans of another.
  def plans
    @plans ||= build_plans(SEED)
  end

  test "the staff users of the seed equal the shared fixture" do
    fixture = shared_fixture("demo_accounts.json")
    # stringify_keys turns { email: "x" } into { "email" => "x" }, the form
    # JSON.parse gives.
    seeded = Seeds::DemoStaffUsers::USERS.map(&:stringify_keys)

    assert_equal fixture.fetch("accounts"), seeded
    assert_equal fixture.fetch("password"), Seeds::DemoStaffUsers::PASSWORD
  end

  test "the same seed gives the same plan" do
    assert_equal plans, build_plans(SEED)
  end

  test "another seed gives another plan" do
    assert_not_equal plans.fetch(:accounts), build_plans(SEED + 1).fetch(:accounts)
  end

  test "there are 300 accounts with unique emails and ids from 1 to 300" do
    accounts = plans.fetch(:accounts)

    assert_equal 300, accounts.size
    assert_equal 300, accounts.map { |account| account[:email] }.uniq.size
    assert_equal (1..300).to_a, accounts.map { |account| account[:id] }.sort
  end

  test "every email is on example.com or example.org" do
    plans.fetch(:accounts).each do |account|
      assert_match(/@([a-z]+\.)?example\.(com|org)\z/, account[:email])
    end
  end

  test "signup_context holds exactly the five keys" do
    plans.fetch(:accounts).each do |account|
      assert_equal %w[country device_fingerprint ip referral user_agent], account[:signup_context].keys.sort
    end
  end

  test "every IP is inside the three documentation ranges" do
    plans.fetch(:accounts).each do |account|
      assert_match ALLOWED_IP, account[:signup_context].fetch("ip")
    end

    # Reads every payload as text, so an IP under any key is found.
    plans.fetch(:events).each do |event|
      event[:payload].to_json.scan(ANY_IP).each { |ip| assert_match ALLOWED_IP, ip }
    end
  end

  test "no payload holds an email" do
    plans.fetch(:events).each do |event|
      assert_no_match ANY_EMAIL, event[:payload].to_json
    end
  end

  test "every event has a known type and a payload that is a hash" do
    plans.fetch(:events).each do |event|
      assert_includes Event::EVENT_TYPES, event[:event_type]
      assert_kind_of Hash, event[:payload]
    end
  end

  test "every login event carries an IP" do
    logins = plans.fetch(:events).select { |event| %w[login login_failed].include?(event[:event_type]) }

    assert_not_empty logins
    logins.each { |event| assert_match ALLOWED_IP, event[:payload].fetch("ip") }
  end

  test "every account has one signup event, and no event comes before it" do
    events = plans.fetch(:events).group_by { |event| event[:account_id] }

    plans.fetch(:accounts).each do |account|
      own = events.fetch(account[:id])
      assert_equal 1, own.count { |event| event[:event_type] == "signup" }

      own.each do |event|
        assert_operator event[:days_ago], :<=, account[:days_ago]
        next unless event[:days_ago] == account[:days_ago]

        assert_operator event[:fraction], :>=, account[:fraction]
      end
    end
  end

  test "twelve accounts share one fingerprint and no other account has it" do
    sharing = plans.fetch(:accounts).select do |account|
      account[:signup_context].fetch("device_fingerprint") == Seeds::Synthetic::SHARED_FINGERPRINT
    end

    assert_equal 12, sharing.size
    assert_equal [ :fingerprint_ring ], sharing.map { |account| account[:profile] }.uniq
  end

  test "fifteen accounts signed up from one IP inside one hour" do
    burst = plans.fetch(:accounts).select do |account|
      account[:signup_context].fetch("ip") == Seeds::Synthetic::BURST_IP
    end
    fractions = burst.map { |account| account[:fraction] }

    assert_equal 15, burst.size
    assert_equal 1, burst.map { |account| account[:days_ago] }.uniq.size
    assert_operator fractions.max - fractions.min, :<=, 1.0 / 24
  end

  test "no two other accounts signed up from the same IP" do
    ips = plans.fetch(:accounts)
      .map { |account| account[:signup_context].fetch("ip") }
      .reject { |ip| ip == Seeds::Synthetic::BURST_IP }

    assert_equal ips.size, ips.uniq.size
  end

  test "the miners have many cpu_spike events and deploys" do
    accounts_with_profile(:miner).each do |account|
      assert_operator count_events(account, "cpu_spike"), :>=, 20
      assert_operator count_events(account, "deploy"), :>=, 4
    end
  end

  test "the phishers have a burst of abuse reports that mention phishing" do
    accounts_with_profile(:phisher).each do |account|
      reports = events_of(account).select { |event| event[:event_type] == "abuse_report" }

      assert_operator reports.size, :>=, 6
      assert_equal 1, reports.map { |event| event[:days_ago] }.uniq.size
      reports.each { |event| assert_match(/phishing/i, event[:payload].fetch("summary")) }
    end
  end

  test "the card testers fail more payments than they make" do
    accounts_with_profile(:card_tester).each do |account|
      assert_operator count_events(account, "payment_failed"), :>=, 9
      assert_operator count_events(account, "payment_failed"), :>, count_events(account, "payment") * 2
    end
  end

  test "some accounts are on a disposable domain under example.org" do
    domains = accounts_with_profile(:disposable).map { |account| account[:email].split("@").last }

    assert_equal 6, domains.size
    assert_includes domains, "mailinator.example.org"
    domains.each { |domain| assert domain.end_with?(".example.org") }
  end

  test "a complete stats row counts the events of its day" do
    stat = plans.fetch(:stats).find { |row| row[:computed_fraction].nil? && row[:counts].values.sum > 3 }
    day_events = plans.fetch(:events).select do |event|
      event[:account_id] == stat[:account_id] && event[:days_ago] == stat[:days_ago]
    end

    AccountDailyStat::COUNTER_FOR_EVENT_TYPE.each do |event_type, column|
      expected = day_events.count { |event| event[:event_type] == event_type }
      assert_equal expected, stat[:counts].fetch(column), column
    end
  end

  test "there is one stats row per account and day that has events" do
    days_with_events = plans.fetch(:events).map { |event| [ event[:account_id], event[:days_ago] ] }.uniq
    gap_ids = accounts_with_profile(:stats_gap).map { |account| account[:id] }
    expected = days_with_events.reject { |account_id, days_ago| gap_ids.include?(account_id) && days_ago <= 1 }
    rows = plans.fetch(:stats).map { |row| [ row[:account_id], row[:days_ago] ] }

    assert_equal expected.sort, rows.sort
  end

  test "twenty accounts have events but no stats row for today and yesterday" do
    gap = accounts_with_profile(:stats_gap)
    assert_equal 20, gap.size

    gap.each do |account|
      [ 0, 1 ].each do |days_ago|
        assert events_of(account).any? { |event| event[:days_ago] == days_ago }
        assert_nil stats_row(account, days_ago)
      end
      assert_not_nil stats_row(account, account[:days_ago])
    end
  end

  test "ten accounts have a row for yesterday that misses the later events" do
    stale = accounts_with_profile(:stats_stale)
    assert_equal 10, stale.size

    stale.each do |account|
      row = stats_row(account, 1)
      day_events = events_of(account).select { |event| event[:days_ago] == 1 }
      newer = day_events.select { |event| event[:fraction] > row[:computed_fraction] }
      # Array minus array: the events that are not in `newer`.
      counted = day_events - newer

      assert_not_empty newer
      assert_not_empty counted
      assert_equal counted.size, row[:counts].values.sum
    end
  end

  test "only the stale rows were computed before their day ended" do
    early = plans.fetch(:stats).reject { |row| row[:computed_fraction].nil? }

    assert_equal 10, early.size
    assert_equal [ 1 ], early.map { |row| row[:days_ago] }.uniq
  end

  test "eight cluster accounts are suspended and four phishing accounts are marked as spam" do
    enforcement = plans.fetch(:enforcement)
    profiles = plans.fetch(:accounts).to_h { |account| [ account[:id], account[:profile] ] }
    suspended = enforcement.select { |action| action[:action_type] == "suspend" }
    marked = enforcement.select { |action| action[:action_type] == "mark_spam" }

    assert_equal 12, enforcement.size
    assert_equal 8, suspended.size
    assert_equal 4, marked.size
    # No account is acted on twice.
    assert_equal 12, enforcement.map { |action| action[:account_id] }.uniq.size

    suspended_profiles = suspended.map { |action| profiles.fetch(action[:account_id]) }.uniq.sort
    assert_equal %i[card_tester fingerprint_ring miner signup_burst], suspended_profiles
    assert_equal [ :phisher ], marked.map { |action| profiles.fetch(action[:account_id]) }.uniq
  end

  test "every seeded action has a reason the rule accepts and a correlation id that is a UUID" do
    plans.fetch(:enforcement).each do |action|
      assert_equal action[:reason], Reason.clean!(action[:reason])
      assert Uuid.valid?(action[:correlation_id]), action[:correlation_id]
      assert_includes EnforcementAction::ACTION_TYPES, action[:action_type]
      assert_no_match ANY_EMAIL, action[:reason]
      assert_no_match ANY_IP, action[:reason]
    end

    ids = plans.fetch(:enforcement).map { |action| action[:correlation_id] }
    assert_equal ids.size, ids.uniq.size
  end

  test "every seeded action comes after the signup, within the last three days" do
    accounts = plans.fetch(:accounts).index_by { |account| account[:id] }

    plans.fetch(:enforcement).each do |action|
      assert_operator action[:days_ago], :<, accounts.fetch(action[:account_id])[:days_ago]
      assert_includes [ 0, 1, 2 ], action[:days_ago]
    end

    assert_operator plans.fetch(:enforcement).map { |action| action[:days_ago] }.uniq.size, :>=, 2
  end

  test "a phishing account is marked after its abuse reports came in" do
    marked = plans.fetch(:enforcement).select { |action| action[:action_type] == "mark_spam" }

    marked.each do |action|
      reports = plans.fetch(:events).select do |event|
        event[:account_id] == action[:account_id] && event[:event_type] == "abuse_report"
      end

      assert_not_empty reports
      reports.each do |report|
        # An array compares element by element, so this reads: an earlier
        # day, or the same day and an earlier moment.
        report_moment = [ -report[:days_ago], report[:fraction] ]
        action_moment = [ -action[:days_ago], action[:fraction] ]
        assert_equal(-1, report_moment <=> action_moment)
      end
    end
  end

  test "the reset empties every table of the app" do
    app_tables = ActiveRecord::Base.connection.tables - %w[schema_migrations ar_internal_metadata]

    assert_equal app_tables.sort, Seeds::Reset::TABLES.sort
  end

  test "the clock never dates anything in the future" do
    now = Time.utc(2026, 9, 30, 0, 0, 30)
    clock = Seeds::Clock.new(now)

    assert_operator clock.at(0, 0.999999), :<=, now
    assert_operator clock.at(0, 0.0), :>=, now.beginning_of_day
    assert_operator clock.computed_after(1), :<=, now
    assert_operator clock.computed_after(0), :<=, now
  end

  test "the clock puts an event on the UTC day it was planned for" do
    clock = Seeds::Clock.new(Time.utc(2026, 9, 30, 15, 0, 0))

    assert_equal Date.new(2026, 9, 30), clock.at(0, 0.5).to_date
    assert_equal Date.new(2026, 9, 29), clock.at(1, 0.0).to_date
    assert_equal Date.new(2026, 9, 29), clock.at(1, 0.999999).to_date
    assert_equal Date.new(2026, 9, 1), clock.date(29)
    assert_equal Time.utc(2026, 9, 30, 0, 10, 0), clock.computed_after(1)
  end

  private

  def build_plans(seed)
    rng = Random.new(seed)
    account_plan = Seeds::AccountPlan.new(rng)
    accounts = account_plan.build
    events = Seeds::EventPlan.new(rng, accounts, account_plan.spare_ips).build
    stats = Seeds::DailyStatsPlan.new(accounts, events).build
    enforcement = Seeds::EnforcementPlan.new(rng, accounts).build

    { accounts: accounts, events: events, stats: stats, enforcement: enforcement }
  end

  def accounts_with_profile(profile)
    plans.fetch(:accounts).select { |account| account[:profile] == profile }
  end

  def events_of(account)
    plans.fetch(:events).select { |event| event[:account_id] == account[:id] }
  end

  def count_events(account, event_type)
    events_of(account).count { |event| event[:event_type] == event_type }
  end

  def stats_row(account, days_ago)
    plans.fetch(:stats).find do |row|
      row[:account_id] == account[:id] && row[:days_ago] == days_ago
    end
  end
end
