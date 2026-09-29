# What: changes the operational mode. It writes the new row of
#   operational_modes and the audit row together, or neither.
# Convention: a service object in app/services/. The file
#   change_operational_mode.rb must define ChangeOperationalMode.
# Closest equivalent: a NestJS provider with one method.
#
# The caller has already checked that the staff user may change the mode.
#
# Two changes at once must not both read the same "previous" mode. An
# account has a row to lock. The mode has none: every change is a new row.
# So this uses an advisory lock, which is a lock on a name, not on a row.
# MySQL gives the name to one connection at a time, and every other
# connection that asks for it waits.

class ChangeOperationalMode
  # The 5 is how many seconds to wait for the lock before giving up.
  TAKE_LOCK = "SELECT GET_LOCK('trust_desk_operational_mode', 5)"
  RELEASE_LOCK = "SELECT RELEASE_LOCK('trust_desk_operational_mode')"

  # Raised when the mode is not normal, elevated or lockdown.
  class InvalidMode < StandardError; end
  # Raised when the mode asked for is the mode in force.
  class ModeUnchanged < StandardError; end
  # Raised when another change held the lock for the whole wait.
  class Busy < StandardError; end

  Result = Data.define(:operational_mode, :audit_log)

  def initialize(staff_user:, mode:, reason:, correlation_id:)
    @staff_user = staff_user
    @mode = mode
    @reason = reason
    @correlation_id = correlation_id
  end

  def call
    reason = Reason.clean!(@reason)
    raise InvalidMode unless OperationalMode::MODES.include?(@mode)

    # with_connection hands the block one database connection. The lock
    # belongs to a connection, so taking it, the transaction and releasing
    # it must all happen on the same one.
    ActiveRecord::Base.with_connection do |connection|
      with_advisory_lock(connection) do
        OperationalMode.transaction do
          previous_mode = OperationalMode.current
          raise ModeUnchanged if previous_mode == @mode

          operational_mode = OperationalMode.create!(
            mode: @mode, reason: reason, staff_user: @staff_user
          )
          audit_log = write_audit_log(operational_mode, previous_mode)

          Result.new(operational_mode: operational_mode, audit_log: audit_log)
        end
      end
    end
  end

  private

  def with_advisory_lock(connection)
    # GET_LOCK answers 1 when the lock was taken and 0 when the wait ran
    # out. select_value returns the one value of a query with one row.
    taken = connection.select_value(TAKE_LOCK)
    raise Busy unless taken == 1

    yield
  # `ensure` runs when the lines above finish and also when they raise, so
  # the lock is given back even when the change was refused. It is the
  # `finally` of TypeScript. Without it a failed change would keep the lock
  # until the connection closes.
  ensure
    connection.select_value(RELEASE_LOCK) if taken == 1
  end

  # A mode change concerns no single account, so the row has no account.
  def write_audit_log(operational_mode, previous_mode)
    AuditLog.create!(
      staff_user: @staff_user,
      account: nil,
      action: "mode.change",
      correlation_id: @correlation_id,
      details: {
        "previous_mode" => previous_mode,
        "new_mode" => operational_mode.mode,
        "reason" => operational_mode.reason
      }
    )
  end
end
