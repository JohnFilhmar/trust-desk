# What: creates the customer accounts under investigation.
# Convention: one migration file per schema change, run in file-name order.
# Closest equivalent: a Prisma or TypeORM migration.

class CreateAccounts < ActiveRecord::Migration[8.1]
  def change
    create_table :accounts do |t|
      t.string :email, null: false
      t.string :status, null: false, default: "active"
      # Null means the account was never marked as spam.
      t.datetime :spam_marked_at, precision: 6
      t.string :plan, null: false
      # Holds ip, country, user_agent, device_fingerprint and referral.
      t.json :signup_context, null: false

      # A generated column is computed by MySQL from another column. These
      # two pull one value each out of the JSON, so that value can be indexed.
      # `stored: false` means MySQL computes it on read and keeps only the
      # index on disk.
      t.virtual :signup_ip, type: :string, limit: 45, stored: false,
        as: "(json_unquote(json_extract(`signup_context`, _utf8mb4'$.ip')))"
      t.virtual :signup_fingerprint, type: :string, limit: 64, stored: false,
        as: "(json_unquote(json_extract(`signup_context`, _utf8mb4'$.device_fingerprint')))"

      t.timestamps precision: 6
    end

    add_index :accounts, :email, unique: true
    add_index :accounts, :signup_ip
    add_index :accounts, :signup_fingerprint
    # Keyset pagination orders by created_at, then id. With status first, a
    # search by status reads the index in order and never sorts.
    add_index :accounts, %i[status created_at id]
    add_index :accounts, %i[created_at id]
  end
end
