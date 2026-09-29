# What: the list of parameter names whose values are replaced by [FILTERED]
#   in the log.
# Convention: Rails runs every file in config/initializers/ once at boot.
#   Restart the server after changing this file.
# Closest equivalent: the `redact` option of pino in the handlers.
#
# Each name matches any parameter that contains it, so :passw also covers
# password and password_confirmation. Active Record uses the same list when
# it prints a record or logs the values of a query.
#
# The first line is the list Rails generates. The second line is ours:
#   - signature and nonce, in case either is ever sent as a parameter
#   - reason, because an analyst can type an email or an IP into it
#   - fingerprint and user_agent, which are PII in this app
# The name `ip` is left out on purpose. It would also match every name that
# contains those two letters, such as description. No request to this
# service carries an IP.
Rails.application.config.filter_parameters += [
  :passw, :email, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn, :cvv, :cvc,
  :signature, :nonce, :reason, :fingerprint, :user_agent
]
