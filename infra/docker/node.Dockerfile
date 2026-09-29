# syntax=docker/dockerfile:1

# One file for every Node image. Build context is the repository root.
#   dev            tools only. Source and node_modules come from Compose.
#   deps           every workspace dependency, from the lockfile
#   handlers_prod  the handlers, run from TypeScript source by Node itself
#   web_build      the static build of the web app
#   web_prod       nginx serving that build

FROM node:22.23.3-slim AS base
RUN corepack enable && corepack prepare pnpm@12.8.1 --activate
WORKDIR /repo

FROM base AS dev
ENV CI=true
CMD ["node", "--version"]

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/handlers/package.json apps/handlers/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY e2e/package.json e2e/
RUN pnpm install --frozen-lockfile

FROM deps AS web_build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @trust-desk/web run build

FROM base AS handlers_prod
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/handlers/package.json apps/handlers/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --prod --filter @trust-desk/handlers...
COPY packages/shared packages/shared
COPY apps/handlers apps/handlers
USER node
WORKDIR /repo/apps/handlers
EXPOSE 8787
CMD ["node", "src/server.ts"]

FROM nginxinc/nginx-unprivileged:1.29-alpine AS web_prod
COPY infra/nginx/web.conf /etc/nginx/conf.d/default.conf
COPY --from=web_build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
