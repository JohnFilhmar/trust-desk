# What: one change of the operational mode. The table is the history, and
#   the newest row is the mode in force.
# Convention: a class in app/models/ maps to the table named after it in the
#   plural, here operational_modes.
# Closest equivalent: a TypeORM entity in NestJS, a Django model.

class OperationalMode < ApplicationRecord
  MODES = %w[normal elevated lockdown].freeze
  DEFAULT_MODE = "normal"

  belongs_to :staff_user

  validates :mode, presence: true, inclusion: { in: MODES }
  validates :reason, presence: true, length: { in: Reason::LENGTH }

  # `def self.` defines a method on the class: OperationalMode.current.
  # Two rows can share a created_at, so the id breaks the tie.
  def self.current
    newest = order(created_at: :desc, id: :desc).first
    return DEFAULT_MODE if newest.nil?

    newest.mode
  end
end
