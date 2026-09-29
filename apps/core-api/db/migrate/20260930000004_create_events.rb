# What: creates the raw event log, one row per thing an account did.
# Convention: one migration file per schema change, run in file-name order.
# Closest equivalent: a Prisma or TypeORM migration.

class CreateEvents < ActiveRecord::Migration[8.1]
  def change
    create_table :events do |t|
      # Adds account_id, an index on it and a foreign key to accounts.
      t.references :account, null: false, foreign_key: true
      # Not named `type`. Rails reserves that column name for single-table
      # inheritance and would try to load a class named after each value.
      t.string :event_type, null: false
      t.datetime :occurred_at, null: false, precision: 6
      t.json :payload, null: false

      # The IP inside the payload, pulled out so it can be indexed.
      t.virtual :payload_ip, type: :string, limit: 45, stored: false,
        as: "(json_unquote(json_extract(`payload`, _utf8mb4'$.ip')))"
    end

    # The timeline of one account, newest first.
    add_index :events, %i[account_id occurred_at id]
    add_index :events, %i[event_type occurred_at]
    add_index :events, :payload_ip
  end
end
