# syntax=docker/dockerfile:1
# API NestJS. Node 20 LTS (A.1).
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
ENV TZ=UTC
RUN corepack enable

FROM base AS dependencias
WORKDIR /repo
# Solo los manifiestos primero: la capa de dependencias se reaprovecha mientras
# el lockfile no cambie.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/schema/package.json packages/schema/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY e2e/package.json e2e/
# `--frozen-lockfile`: en una red con registro espejado, una instalacion que
# modifica el lockfile es una instalacion irreproducible.
RUN pnpm install --frozen-lockfile --filter @paid/api...

FROM dependencias AS compilacion
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @paid/schema --filter @paid/db --filter @paid/api build

FROM base AS ejecucion
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=compilacion /repo/node_modules ./node_modules
COPY --from=compilacion /repo/packages ./packages
COPY --from=compilacion /repo/apps/api ./apps/api
USER node
WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
