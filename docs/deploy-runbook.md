# Deploy runbook

How to put Trust Desk on the EC2 instance that already serves `https://fusion.filhmar.online`, without disturbing that site.

You run every command here. The agent has no access to the server. After each step, compare what you see with "Expect". If they differ, stop and paste the output to the agent before going on.

Commands marked **server** run on the EC2 instance over SSH. Commands marked **laptop** run on your own machine, in the repository root.

## Rules that protect fusion

1. Never edit a file that belongs to fusion, its nginx server block included.
2. Never run `docker system prune`, `docker volume prune` or `docker network prune`. They act on every project on the machine.
3. Every `docker compose` command names this project's file with `-f`. A bare `docker compose down` in the wrong folder would stop the wrong site.
4. Reload nginx, never restart it. A reload keeps serving while it swaps the config. A restart drops every connection, fusion's included.
5. Run `nginx -t` before every reload. A config with an error takes down every site nginx serves.
6. After every step that touches nginx or Docker, check that fusion still answers.

## Memory budget

Each container has a hard limit. A container that reaches its limit is restarted alone, and cannot take memory from fusion.

| Container | Limit | Measured | Why this limit |
|---|---|---|---|
| mysql | 400 MB | 150 MB | InnoDB buffer pool of 96 MB, performance schema off, binary log off |
| core-api | 400 MB | 118 MB | Rails with Puma, 3 threads, 1 process |
| handlers | 200 MB | 60 MB | Node, one process |
| web | 64 MB | 13 MB | nginx serving static files |
| migrate | 400 MB | not measured | Runs for a few seconds per deploy, then exits |
| **Total while running** | **1064 MB** | **341 MB** | migrate not counted, since it exits |

"Measured" is what `docker stats` showed on 2026-09-30, on a development machine, with the production images just after the seed and a handful of requests. It is an idle figure. Under load, expect MySQL and Rails to grow toward their limits.

The limits are ceilings. A container that reaches its limit is restarted alone.

| On disk | Size |
|---|---|
| mysql image | 1.11 GB |
| core-api image | 995 MB |
| handlers image | 762 MB |
| web image | 82 MB |
| **Images in total** | **about 2.9 GB** |

Keeping the previous version for rollback roughly doubles that for the three images that change.

**What the server needs:**

- Memory: 500 MB free or reclaimable with fusion running is the least this app needs to idle. 1.1 GB covers every container at its limit. Between the two, it runs, and a busy moment can restart a container.
- Disk: 6 GB free, for two versions of the images and the database.

If the server has less, stop. The options then are a larger instance, swap, or lower limits, and that choice is yours.

**Two images are larger than they need to be.** The Rails image carries the compiler used to build gems, and the handlers image carries pnpm's package store. A second build stage that copies only the results would cut both by more than half. That was left out to keep the Dockerfiles short enough to explain.

## Step 1: preflight, read-only (server)

Nothing in this step changes anything.

```
free -m
swapon --show
df -h /
nproc
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}'
docker network ls
docker volume ls
sudo ss -ltnp | grep -E ':(80|443|18080|18787)\s'
nginx -v
sudo nginx -T 2>/dev/null | grep -E 'server_name|listen ' | sort -u
certbot --version
ls /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null
curl -s -o /dev/null -w 'fusion: %{http_code}\n' https://fusion.filhmar.online
```

Expect:

- `free -m`: the `available` column is 1100 or more. Between 500 and 1100, read "What the server needs" above before going on. Below 500, stop.
- `df -h /`: `Avail` is 6G or more.
- `ss`: ports 80 and 443 belong to nginx. **Ports 18080 and 18787 do not appear.** If either appears, something already uses it. Pick two free ports, and use them in step 4 and step 6.
- `docker network ls` and `docker volume ls`: nothing starts with `trust-desk`.
- `fusion: 200`, or whatever fusion answers today. Write that number down. It is what "fusion still answers" means in every later step.

Paste the whole output to the agent. It writes the final memory budget from these numbers and tells you plainly whether the instance can hold this app.

## Step 2: DNS (your DNS provider)

Add an A record: `trust.filhmar.online` pointing at the instance's public IP.

Then, on your laptop:

```
nslookup trust.filhmar.online
```

Expect: the instance's public IP. It can take from a minute to an hour. Do not go on to step 7 before this answers correctly, since the certificate cannot be issued without it.

## Step 3: build and push the images (laptop)

CI cannot build them yet, since GitHub Actions is blocked by a billing problem on the account. They are built on your laptop.

**Check the images on your laptop first.** Two bugs so far existed only in the production images, and both were found this way and not on the server. `infra/scripts/check_production_images.sh` says in its header how to start them, and then runs 18 checks. On 2026-09-30 all 18 passed.

**Allow time for the build.** The handlers image took 11 minutes 28 seconds to install its packages on the first build, against 18 seconds in development. The cause is not known. Later builds reuse the layer and are fast, as long as the lockfile has not changed.

You need a GitHub personal access token with the `write:packages` scope. Create it under GitHub, Settings, Developer settings, Personal access tokens.

```
docker login ghcr.io -u JohnFilhmar
```

Paste the token when asked. Then:

```
$env:IMAGE_PREFIX = "ghcr.io/johnfilhmar"
$env:IMAGE_TAG = (git rev-parse --short HEAD)

docker build -t "$env:IMAGE_PREFIX/trust-desk-mysql:$env:IMAGE_TAG" ./infra/mysql
docker build -t "$env:IMAGE_PREFIX/trust-desk-core-api:$env:IMAGE_TAG" --target prod ./apps/core-api
docker build -t "$env:IMAGE_PREFIX/trust-desk-handlers:$env:IMAGE_TAG" --target handlers_prod -f infra/docker/node.Dockerfile .
docker build -t "$env:IMAGE_PREFIX/trust-desk-web:$env:IMAGE_TAG" --target web_prod -f infra/docker/node.Dockerfile .

docker push "$env:IMAGE_PREFIX/trust-desk-mysql:$env:IMAGE_TAG"
docker push "$env:IMAGE_PREFIX/trust-desk-core-api:$env:IMAGE_TAG"
docker push "$env:IMAGE_PREFIX/trust-desk-handlers:$env:IMAGE_TAG"
docker push "$env:IMAGE_PREFIX/trust-desk-web:$env:IMAGE_TAG"

echo $env:IMAGE_TAG
```

Expect: four pushes that end in a `digest: sha256:` line. Write down the tag the last line prints.

## Step 4: files on the server (server)

```
sudo mkdir -p /opt/trust-desk
sudo chown "$USER" /opt/trust-desk
cd /opt/trust-desk
```

Copy `docker-compose.prod.yml` from the repository into `/opt/trust-desk`. From your laptop:

```
scp docker-compose.prod.yml <user>@<server>:/opt/trust-desk/
```

Create the env file on the server, by hand. It never leaves the server.

```
cd /opt/trust-desk
umask 077
nano .env
```

Paste the block from `docs/env-reference.md` and fill in every empty value. Generate each secret on the server:

```
openssl rand -hex 32
```

Run it once for each of: `MYSQL_ROOT_PASSWORD`, `DB_ADMIN_PASSWORD`, `DB_CORE_API_PASSWORD`, `DB_HANDLERS_PASSWORD`, `SESSION_SECRET`, `SERVICE_HMAC_SECRET`. For `SECRET_KEY_BASE` run `openssl rand -hex 64`.

Add these four lines to the same file:

```
IMAGE_PREFIX=ghcr.io/johnfilhmar
IMAGE_TAG=<the tag from step 3>
WEB_HOST_PORT=18080
HANDLERS_HOST_PORT=18787
```

Check:

```
ls -l /opt/trust-desk/.env
grep -c '=$' /opt/trust-desk/.env
docker compose -f /opt/trust-desk/docker-compose.prod.yml config --quiet && echo CONFIG_OK
```

Expect:

- permissions `-rw-------`
- the count of lines ending in `=` is `0`, meaning no value is empty
- `CONFIG_OK`

`SESSION_SECRET` and `SERVICE_HMAC_SECRET` must differ. The handlers refuse to start when they are equal.

## Step 5: start the stack (server)

```
cd /opt/trust-desk
docker login ghcr.io -u JohnFilhmar
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps -a
```

Expect, within about a minute:

| Service | State |
|---|---|
| mysql | running, healthy |
| migrate | exited (0) |
| core-api | running, healthy |
| handlers | running, healthy |
| web | running, healthy |

If `migrate` exited with anything but 0:

```
docker compose -f docker-compose.prod.yml logs migrate | tail -40
```

Then load the demo data, once:

```
docker compose -f docker-compose.prod.yml run --rm migrate bin/rails db:seed
```

Expect: a summary that ends with the counts per table.

Check from the server itself:

```
curl -s -w '\n%{http_code}\n' http://127.0.0.1:18787/api/health
curl -s -o /dev/null -w 'web: %{http_code}\n' http://127.0.0.1:18080/
curl -s -o /dev/null -w 'fusion: %{http_code}\n' https://fusion.filhmar.online
sudo ss -ltnp | grep -E ':(3000|3306)\s' || echo 'rails and mysql: not published'
```

Expect:

- `{"status":"ok","database":"up"}` and `200`
- `web: 200`
- `fusion:` the same number as in step 1
- `rails and mysql: not published`

## Step 6: nginx, without the certificate yet (server)

Back up first. This is what rollback restores.

```
sudo cp -a /etc/nginx /etc/nginx.backup.$(date +%Y%m%d%H%M%S)
ls -d /etc/nginx.backup.*
```

Copy the two files from the repository to the server, from your laptop:

```
scp infra/nginx/host_trust_desk.conf infra/nginx/trust_desk_proxy.conf <user>@<server>:/tmp/
```

On the server:

```
sudo mkdir -p /etc/nginx/snippets /var/www/certbot
sudo cp /tmp/trust_desk_proxy.conf /etc/nginx/snippets/trust_desk_proxy.conf
```

The certificate does not exist yet, and nginx refuses a config that names a missing file. So install only the port 80 part first:

```
sudo tee /etc/nginx/sites-available/trust.filhmar.online >/dev/null <<'EOF'
server {
  listen 80;
  listen [::]:80;
  server_name trust.filhmar.online;
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 404; }
}
EOF
sudo ln -s /etc/nginx/sites-available/trust.filhmar.online /etc/nginx/sites-enabled/trust.filhmar.online
sudo nginx -t
```

Expect: `syntax is ok` and `test is successful`. **If not, do not reload.** Remove the link with `sudo rm /etc/nginx/sites-enabled/trust.filhmar.online` and paste the error to the agent.

If your nginx keeps sites in `/etc/nginx/conf.d/` and has no `sites-enabled`, which step 1 shows, write the file to `/etc/nginx/conf.d/trust.filhmar.online.conf` and skip the `ln`.

```
sudo systemctl reload nginx
curl -s -o /dev/null -w 'fusion: %{http_code}\n' https://fusion.filhmar.online
```

Expect: `fusion:` the same number as in step 1.

## Step 7: the certificate (server)

```
sudo certbot certonly --webroot -w /var/www/certbot -d trust.filhmar.online
sudo ls /etc/letsencrypt/live/trust.filhmar.online/
```

Expect: `Successfully received certificate`, and the files `fullchain.pem` and `privkey.pem`.

`certonly` writes the certificate and edits nothing in nginx. One certificate covers the one name this app is served under.

## Step 8: nginx, the full config (server)

If step 1 showed that ports 18080 or 18787 were taken, edit the two `proxy_pass` lines in `/tmp/host_trust_desk.conf` first.

```
sudo cp /tmp/host_trust_desk.conf /etc/nginx/sites-available/trust.filhmar.online
sudo nginx -t
```

Expect: `syntax is ok` and `test is successful`. If not, restore the port 80 file from step 6 and paste the error to the agent.

```
sudo systemctl reload nginx
curl -s -o /dev/null -w 'fusion: %{http_code}\n' https://fusion.filhmar.online
curl -s -w '\n%{http_code}\n' https://trust.filhmar.online/api/health
curl -s -o /dev/null -w 'page: %{http_code}\n' https://trust.filhmar.online/
curl -s -o /dev/null -w 'deep link: %{http_code}\n' https://trust.filhmar.online/accounts/1
curl -sI https://trust.filhmar.online/ | grep -i -E 'content-security-policy|strict-transport|x-frame|x-robots'
curl -s -o /dev/null -w 'http: %{http_code}\n' http://trust.filhmar.online/
```

Expect:

- `fusion:` the same number as in step 1
- `{"status":"ok","database":"up"}` and `200`
- `page: 200`
- `deep link: 200`, which proves a refresh on an account page works
- four header lines
- `http: 301`

## Step 9: smoke test and real memory use

On your laptop, run the same Playwright test against the live site:

```
docker compose -f docker-compose.dev.yml --profile e2e run --rm -e BASE_URL=https://trust.filhmar.online e2e
```

Expect: every test passes.

The smoke test suspends an account. Reset the data afterwards, on the server:

```
cd /opt/trust-desk
docker compose -f docker-compose.prod.yml run --rm migrate bin/rails db:seed
```

Then measure, on the server:

```
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}'
free -m
```

Paste the output to the agent. Expect every `trust-desk` container well under its limit.

## Step 10: the daily reset (server)

The demo is public and its credentials are published, so a visitor can suspend every account. The seed rebuilds the data from a fixed random seed, as the admin database user.

```
sudo tee /etc/cron.d/trust-desk-reset >/dev/null <<'EOF'
# Rebuilds the Trust Desk demo data every day at 20:00 UTC, 04:00 in UTC+8.
0 20 * * * root cd /opt/trust-desk && /usr/bin/docker compose -f docker-compose.prod.yml run --rm -T migrate bin/rails db:seed >> /var/log/trust-desk-reset.log 2>&1
EOF
sudo chmod 644 /etc/cron.d/trust-desk-reset
```

The audit table rejects DELETE. The seed empties it with TRUNCATE, which the trigger does not see and which needs a privilege only the admin user holds. No running service can do it.

## Step 11: certificate renewal

certbot installs a timer that renews by itself. Check it, and tell it to reload nginx after a renewal:

```
sudo systemctl list-timers | grep -i certbot
sudo certbot renew --dry-run
echo 'renew_hook = systemctl reload nginx' | sudo tee -a /etc/letsencrypt/renewal/trust.filhmar.online.conf
```

Expect: a certbot timer in the list, and `Congratulations, all simulated renewals succeeded`.

## Rollback

Written before the first deploy, as the brief asks. Pick the smallest one that fixes the problem.

### A deploy of a new version went wrong

The previous images are still on the server. Go back to the previous tag:

```
cd /opt/trust-desk
nano .env          # set IMAGE_TAG back to the previous tag
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps -a
```

A migration that already ran is not undone by this. If the new version changed the schema, tell the agent before rolling back.

### nginx is broken

```
sudo rm /etc/nginx/sites-enabled/trust.filhmar.online
sudo nginx -t && sudo systemctl reload nginx
curl -s -o /dev/null -w 'fusion: %{http_code}\n' https://fusion.filhmar.online
```

That removes this site and leaves every other one as it was. If `nginx -t` still fails, restore the backup from step 6:

```
ls -d /etc/nginx.backup.*
sudo cp -a /etc/nginx.backup.<the timestamp>/. /etc/nginx/
sudo nginx -t && sudo systemctl reload nginx
```

### Take the whole app off the server

```
cd /opt/trust-desk
docker compose -f docker-compose.prod.yml down
sudo rm /etc/nginx/sites-enabled/trust.filhmar.online
sudo nginx -t && sudo systemctl reload nginx
sudo rm /etc/cron.d/trust-desk-reset
```

`down` stops and removes this project's containers and networks. It keeps the database volume. Add `-v` only when you mean to delete the data as well.

### fusion stopped answering

Do this first, before looking for the cause:

```
cd /opt/trust-desk
docker compose -f docker-compose.prod.yml stop
free -m
curl -s -o /dev/null -w 'fusion: %{http_code}\n' https://fusion.filhmar.online
```

`stop` frees this app's memory and keeps everything else in place. Then paste `free -m`, `docker ps -a` and `sudo journalctl -u nginx -n 50` to the agent.

## Deploying a new version later

1. Laptop: step 3, which gives a new tag.
2. Server: set `IMAGE_TAG` in `/opt/trust-desk/.env` to the new tag.
3. Server:

```
cd /opt/trust-desk
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps -a
curl -s https://trust.filhmar.online/api/health
curl -s -o /dev/null -w 'fusion: %{http_code}\n' https://fusion.filhmar.online
```

4. Laptop: the smoke test from step 9, then the reset.
