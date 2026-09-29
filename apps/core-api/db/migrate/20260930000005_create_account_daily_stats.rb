# What: creates the pre-aggregated table. One row per account per UTC day,
#   holding how many events of each kind happened.
# Convention: one migration file per schema change, run in file-name order.
# Closest equivalent: a Prisma or TypeORM migration.
#
# It stores counts and never a risk score. The score is computed in one
# place, a TypeScript function, so the two services cannot disagree.

class CreateAccountDailyStats < ActiveRecord::Migration[8.1]
  COUNTERS = %i[
    logins failed_logins payments failed_payments
    deploys cpu_spikes abuse_reports api_bursts
  ].freeze

  def change
    create_table :account_daily_stats do |t|
      t.references :account, null: false, foreign_key: true
      t.date :day, null: false

      COUNTERS.each do |counter|
        t.integer :"#{counter}_count", null: false, default: 0
      end

      # When the row was last computed. A day is stale when the account has
      # an event on that day newer than this.
      t.datetime :computed_at, null: false, precision: 6
    end

    add_index :account_daily_stats, %i[account_id day], unique: true
  end
end
