# syntax=docker/dockerfile:1

# One file, three stages:
#   base  shared operating system packages
#   dev   source is mounted from the host, gems live in the image
#   prod  source is copied in, runs as a user that cannot write to it

FROM ruby:4.0.7-slim AS base
WORKDIR /app
# libmysqlclient is what the mysql2 gem links against.
# The MySQL client provides mysqldump, which Rails calls to write db/structure.sql.
RUN apt-get update -qq \
  && apt-get install -y --no-install-recommends \
       build-essential libyaml-dev default-libmysqlclient-dev pkg-config \
       default-mysql-client \
  && rm -rf /var/lib/apt/lists/*
# Debian's MySQL client is the MariaDB one. It insists on a certificate
# signed by a known authority, and the MySQL image signs its own. Both
# containers sit on one private Docker network, so the client is told not to
# verify. Rails calls this client for db/structure.sql, in both directions.
RUN printf '[client]\nssl-verify-server-cert = off\n' > /etc/mysql/conf.d/trust_desk_client.cnf
ENV BUNDLE_PATH=/usr/local/bundle

FROM base AS dev
ENV RAILS_ENV=development
# bundler-audit downloads its list of known vulnerabilities with git.
RUN apt-get update -qq \
  && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/*
COPY Gemfile Gemfile.lock .ruby-version ./
RUN bundle install
EXPOSE 3000
# -b 0.0.0.0 makes Puma listen on every interface inside the container.
# Listening on 127.0.0.1 would make it unreachable from other containers.
CMD ["bin/rails", "server", "-b", "0.0.0.0", "-p", "3000"]

FROM base AS prod
ENV RAILS_ENV=production \
    BUNDLE_DEPLOYMENT=1 \
    BUNDLE_WITHOUT=development:test
COPY Gemfile Gemfile.lock .ruby-version ./
RUN bundle install
COPY . .
RUN useradd --system --uid 1001 --create-home rails \
  && mkdir -p tmp log \
  && chown -R rails:rails tmp log
USER rails
EXPOSE 3000
CMD ["bin/rails", "server", "-b", "0.0.0.0", "-p", "3000"]
