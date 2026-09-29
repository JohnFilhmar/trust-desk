# What: the list of parameter names whose values are replaced by [FILTERED]
#   in the log.
# Convention: Rails runs every file in config/initializers/ once at boot.
#   Restart the server after changing this file.
# Closest equivalent: the `redact` option of pino in the handlers.
#
# A symbol matches any parameter whose name contains it, so :passw covers
# password, password_confirmation and password_digest. Active Record uses
# the same list when it prints a record.
#
# The first line is the list Rails generates. The rest is ours:
#   - signature and nonce, in case either is ever sent as a parameter
#   - reason, because an analyst can type an email or an IP into it
#   - fingerprint and user_agent, which are PII in this app
#   - ip, written as a pattern. The symbol :ip would also match every name
#     that contains those two letters, such as description. The pattern
#     matches ip itself and any name that ends in _ip, such as signup_ip.
#
# What this list does not cover: the SQL lines of the development log. The
# mysql2 adapter writes each value into the SQL text, so those lines hold
# the values as sent. Production logs at the level info, which has no SQL
# lines.
Rails.application.config.filter_parameters += [
  :passw, :email, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn, :cvv, :cvc,
  :signature, :nonce, :reason, :fingerprint, :user_agent,
  /(\A|_)ip\z/
]
