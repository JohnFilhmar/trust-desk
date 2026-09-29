# What: creates the table that remembers which signed requests were already
#   seen, so the same request cannot be replayed.
# Convention: every file in db/migrate/ is one schema change. The number in
#   the file name is a timestamp and sets the order. The class name must be
#   the file name in CamelCase, or Rails cannot find it.
# Closest equivalent: a TypeORM or Prisma migration, a Django migration.
#
# `[8.1]` pins the migration to the behavior of Rails 8.1, so it still means
# the same thing after an upgrade.

class CreateSignedRequestNonces < ActiveRecord::Migration[8.1]
  # `change` describes the forward step only. Rails works out the reverse
  # (drop the table) by itself when the migration is rolled back.
  def change
    # create_table adds a bigint auto-increment `id` primary key unless told not to.
    create_table :signed_request_nonces do |t|
      t.string :nonce, null: false, limit: 64
      # precision: 6 keeps microseconds.
      t.datetime :seen_at, null: false, precision: 6
    end

    # The unique index is what rejects a replay. Two requests carrying the
    # same nonce cannot both be inserted, even when they arrive together.
    add_index :signed_request_nonces, :nonce, unique: true
    # Used to delete rows older than the time window.
    add_index :signed_request_nonces, :seen_at
  end
end
