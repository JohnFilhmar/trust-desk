# What: creates the record of every action taken against an account.
# Convention: one migration file per schema change, run in file-name order.
# Closest equivalent: a Prisma or TypeORM migration.

class CreateEnforcementActions < ActiveRecord::Migration[8.1]
  def change
    create_table :enforcement_actions do |t|
      t.references :account, null: false, foreign_key: true
      t.references :staff_user, null: false, foreign_key: true
      # suspend, unsuspend or mark_spam. Not named `type`, see the events migration.
      t.string :action_type, null: false
      t.text :reason, null: false
      t.string :correlation_id, null: false, limit: 36
      # Only created_at. An enforcement action is never edited.
      t.datetime :created_at, null: false, precision: 6
    end

    add_index :enforcement_actions, %i[account_id created_at id]
  end
end
