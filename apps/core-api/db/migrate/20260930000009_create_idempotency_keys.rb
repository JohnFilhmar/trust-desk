# What: creates the table that remembers the answer to each enforcement
#   request, so the same request sent twice acts once.
# Convention: one migration file per schema change, run in file-name order.
# Closest equivalent: a Prisma or TypeORM migration.
#
# The browser makes a key when an enforcement dialog opens and sends it with
# every submit from that dialog. A double click, or a retry after a timeout,
# carries the same key and gets the stored answer back.

class CreateIdempotencyKeys < ActiveRecord::Migration[8.1]
  def change
    create_table :idempotency_keys do |t|
      # A UUID, as text.
      t.string :key, null: false, limit: 36
      t.references :staff_user, null: false, foreign_key: true
      # Such as POST /internal/accounts/42/suspend. One key belongs to one endpoint.
      t.string :request_path, null: false
      # SHA-256 of the request body without the key. It tells a repeat of
      # the same request from a different request that reuses the key.
      t.string :request_hash, null: false, limit: 64
      t.integer :response_status, null: false
      t.json :response_body, null: false
      t.datetime :created_at, null: false, precision: 6
    end

    # The unique index is what settles two identical requests that arrive
    # together. Only one insert can succeed.
    add_index :idempotency_keys, :key, unique: true
    add_index :idempotency_keys, :created_at
  end
end
