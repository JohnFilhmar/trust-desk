# What: creates the table of people who use the console.
# Convention: one migration file per schema change, run in file-name order.
# Closest equivalent: a Prisma or TypeORM migration.

class CreateStaffUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :staff_users do |t|
      t.string :email, null: false
      t.string :display_name, null: false
      # has_secure_password expects this exact column name. It stores a bcrypt hash.
      t.string :password_digest, null: false
      # Not named `group`, which is a reserved word in SQL.
      t.string :group_name, null: false

      # Adds created_at and updated_at. Rails fills both in by itself.
      t.timestamps precision: 6
    end

    add_index :staff_users, :email, unique: true
  end
end
