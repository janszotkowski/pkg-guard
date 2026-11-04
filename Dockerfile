# The worker's image: `docker compose up --build worker`. It installs npm packages to measure them, so it runs only here,
# where they stay on the container's own volume and never reach the machine it runs on.
#
# The Node and pnpm versions are the ones in .node-version and package.json: change them together (`pnpm policy` fails when they differ).
# The base image is pinned by digest: a re-pushed tag cannot change what is built.

FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS build
ENV PNPM_HOME=/pnpm CI=true
ENV PATH=$PNPM_HOME:$PATH
RUN npm install --global pnpm@12.14.0
WORKDIR /repo
# The manifests only: copying them first keeps the install layer when only source changes. The lockfile covers every app, so every manifest is here.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --store-dir /pnpm/store --filter @pkg-guard/worker...
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY apps/worker apps/worker
# Only the production dependencies, with the built files, in one folder.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm --filter @pkg-guard/worker build \
    && pnpm --filter @pkg-guard/worker deploy --prod --prefer-offline --store-dir /pnpm/store /out/worker

FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS worker
# The worker installs packages with pnpm when it runs. Before HOME is set below: npm would otherwise leave its cache in /work.
RUN npm install --global pnpm@12.14.0
ENV NODE_ENV=production WORKER_IN_CONTAINER=true WORKER_DIR=/work HOME=/work/home
WORKDIR /app
COPY --from=build --chown=node:node /out/worker/package.json ./
COPY --from=build --chown=node:node /out/worker/node_modules node_modules
COPY --from=build --chown=node:node /out/worker/dist dist
# Everything it downloads, and pnpm's own state, lives on this volume. `pnpm worker:clean` removes it.
RUN mkdir /work && chown node:node /work
VOLUME /work
USER node
CMD ["node", "dist/main.worker.mjs"]
