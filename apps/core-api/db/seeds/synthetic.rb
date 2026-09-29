# What: the raw material of the synthetic data: the IP ranges, the word
#   lists, and the two values the abuse clusters share.
# Convention: none. db/seeds.rb loads this file with require_relative.
# Closest equivalent: a constants module next to a TypeScript seed script.
#
# Nothing here is real. Every IP comes from the three ranges that RFC 5737
# sets aside for documentation, and every email is on example.com or
# example.org.
#
# Every method that needs randomness takes the seeded generator as `rng`.
# The global `rand` is never called, so every run gives the same data.

module Seeds
  module Synthetic
    IP_PREFIXES = %w[192.0.2 198.51.100 203.0.113].freeze

    # The one IP the signup burst comes from.
    BURST_IP = "203.0.113.77"
    # The one device fingerprint the ring of 12 accounts shares.
    SHARED_FINGERPRINT = "9f2c4e6a8b0d1f3e5a7c9e1b3d5f7a90"

    EMAIL_DOMAINS = %w[example.com example.org].freeze
    DISPOSABLE_DOMAINS = %w[
      mailinator.example.org tempmail.example.org guerrillamail.example.org
    ].freeze

    PLANS = %w[free free free pro pro team].freeze
    PAID_PLAN_PRICES = { "pro" => 1900, "team" => 4900 }.freeze
    COUNTRIES = %w[US US GB DE FR NL PH SG IN BR CA AU JP NG].freeze
    REGIONS = %w[us-east us-west eu-central ap-southeast].freeze
    REFERRALS = [ nil, nil, nil, "search", "friend-invite", "partner-blog", "conference" ].freeze

    USER_AGENTS = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15",
      "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36"
    ].freeze

    FIRST_NAMES = %w[
      maria jose ana liam noah emma olivia lucas mia ethan sofia arjun priya
      chen yuki omar fatima diego elena tomas ingrid kofi amara nina pavel
    ].freeze
    LAST_NAMES = %w[
      santos reyes cruz garcia smith jones brown mueller dubois rossi tanaka
      kumar singh wang okafor haddad novak silva jansen larsen
    ].freeze

    module_function

    # Every host address of the three ranges, in a seeded random order, with
    # the burst IP taken out so no other account can land on it.
    def ip_pool(rng)
      # flat_map runs the block for each prefix and joins the arrays.
      all = IP_PREFIXES.flat_map do |prefix|
        (1..254).map { |host| "#{prefix}.#{host}" }
      end

      (all - [ BURST_IP ]).shuffle(random: rng)
    end

    # 32 hex characters. `%032x` writes a number in hex, padded with zeros.
    def fingerprint(rng)
      format("%032x", rng.rand(2**128))
    end

    # `sample` picks one element. `random:` makes it use the seeded generator.
    def pick(list, rng)
      list.sample(random: rng)
    end
  end
end
