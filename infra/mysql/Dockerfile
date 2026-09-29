# syntax=docker/dockerfile:1

# MySQL with this project's settings copied in. They are copied, not mounted,
# because MySQL ignores a config file that anyone can write to, and a file
# mounted from a Windows host arrives with exactly those permissions.
FROM mysql:8.4

COPY --chmod=0644 conf.d/trust_desk.cnf /etc/mysql/conf.d/trust_desk.cnf
COPY --chmod=0755 init/01_create_users.sh /docker-entrypoint-initdb.d/01_create_users.sh
