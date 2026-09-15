# syntax=docker/dockerfile:1
# Interfaz React + Vite, servida como estatico por nginx.
#
# A.2.1 — el bundle no resuelve nada contra internet en tiempo de ejecucion:
# fuentes, teselas y todos los activos salen de este mismo contenedor.
FROM node:20-bookworm-slim AS compilacion
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/schema/package.json packages/schema/
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
COPY e2e/package.json e2e/
RUN pnpm install --frozen-lockfile --filter @paid/web... --filter @paid/schema
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm --filter @paid/schema --filter @paid/web build

FROM nginx:1.27-alpine AS ejecucion
COPY --from=compilacion /repo/apps/web/dist /usr/share/nginx/html
COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
