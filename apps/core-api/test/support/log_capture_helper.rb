# What: a helper that collects the log lines written while a block runs, so
#   a test can read them.
# Convention: Rails has no folder for test helpers. This app uses
#   test/support/, and test/test_helper.rb requires every file in it.
# Closest equivalent: a pino destination that writes to an array in a Jest
#   test.
#
# Rails.logger is a BroadcastLogger: it passes every line on to a list of
# loggers. This helper adds one more logger to that list, which writes into
# a string, and takes it off again afterwards.

module LogCaptureHelper
  # level - the lowest level to keep. Logger::DEBUG keeps everything, SQL
  #   lines included. Logger::INFO is what production logs.
  #
  # Returns the lines as an array of strings.
  def capture_log(level: Logger::DEBUG)
    # StringIO is a string that behaves like a file.
    output = StringIO.new
    logger = ActiveSupport::TaggedLogging.new(ActiveSupport::Logger.new(output))
    logger.level = level

    Rails.logger.broadcast_to(logger)
    yield

    # `lines` splits at the line breaks, `chomp` drops each line break, and
    # `reject` drops the empty lines.
    output.string.lines.map(&:chomp).reject(&:empty?)
  # `ensure` runs whether the block raised or not.
  ensure
    Rails.logger.stop_broadcasting_to(logger)
  end
end
