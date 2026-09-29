# What: creates the history of operational mode changes.
# Convention: one migration file per schema change, run in file-name order.
# Closest equivalent: a Prisma or TypeORM migration.
#
# Each change is a new row. The current mode is the newest row. Nothing is
# ever updated, so the table is also the history of who changed the mode.

class CreateOperationalModes < ActiveRecord::Migration[8.1]
  def change
    create_table :operational_modes do |t|
      # normal, elevated or lockdown.
      t.string :mode, null: false
      t.text :reason, null: false
      t.references :staff_user, null: false, foreign_key: true
      t.datetime :created_at, null: false, precision: 6
    end

    add_index :operational_modes, %i[created_at id]
  end
end
