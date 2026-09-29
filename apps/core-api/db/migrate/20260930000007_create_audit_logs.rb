# What: creates the audit log and makes it append-only.
# Convention: one migration file per schema change, run in file-name order.
# Closest equivalent: a Prisma or TypeORM migration with a raw SQL step.
#
# This migration uses `up` and `down`, not `change`. Rails can reverse a
# create_table by itself, but it cannot guess how to undo raw SQL, so both
# directions are written out.

class CreateAuditLogs < ActiveRecord::Migration[8.1]
  def up
    create_table :audit_logs do |t|
      t.references :staff_user, null: false, foreign_key: true
      # Nullable: a mode change concerns no single account.
      t.references :account, foreign_key: true
      # What happened, such as account.suspend or pii.reveal.
      t.string :action, null: false
      t.json :details, null: false
      t.string :correlation_id, null: false, limit: 36
      # No updated_at. A row in this table never changes.
      t.datetime :created_at, null: false, precision: 6
    end

    add_index :audit_logs, %i[created_at id]
    add_index :audit_logs, %i[account_id created_at id]

    # `execute` runs SQL that Rails has no helper for.
    # SIGNAL raises an error from inside the trigger, which makes MySQL
    # refuse the statement that fired it. 45000 is the code for an error
    # defined by the application.
    execute <<~SQL
      CREATE TRIGGER audit_logs_reject_update
      BEFORE UPDATE ON audit_logs
      FOR EACH ROW
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only: UPDATE is not allowed'
    SQL

    execute <<~SQL
      CREATE TRIGGER audit_logs_reject_delete
      BEFORE DELETE ON audit_logs
      FOR EACH ROW
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only: DELETE is not allowed'
    SQL
  end

  def down
    execute "DROP TRIGGER IF EXISTS audit_logs_reject_update"
    execute "DROP TRIGGER IF EXISTS audit_logs_reject_delete"
    drop_table :audit_logs
  end
end
