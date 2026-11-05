# pkg-guard

**What an npm package really costs your bundle, free and open source.** Search for a package and see its minified, gzip and brotli sizes, what it puts on disk and which packages make up its bundle, measured with a modern bundler. The package's code is never run.

[![CI](https://github.com/janszotkowski/pkg-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/janszotkowski/pkg-guard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Early work in progress. It runs locally only; see [How it's built](docs/ARCHITECTURE.md), including what is still required before a public deployment, and the [TODO](docs/TODO.md).

[How it's built](docs/ARCHITECTURE.md) · [Roadmap](docs/ROADMAP.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [License](LICENSE)

## Features

- **Measured, not guessed**: every package goes through a real bundler (rolldown), and the page says which one and which version. Minified, gzip and brotli sizes, and the time they take to download on 3G and 4G.
- **What it puts on disk**: the install size and the number of packages it brings along, with peer dependencies named.
- **Composition**: which packages make up the bundle, and what share each has.
- **Exports**: the size of each export on its own, for packages that offer more than one.
- **Package health**: licence, TypeScript types, ESM or CommonJS, last release, install scripts, Node built-ins and native add-ons it reaches for.
- **Version history**: how the size changed from release to release, and any version measured on request.
- **Trends**: up to several packages side by side, by size across releases or downloads over time, with GitHub stars.
- **Its code never runs**: packages are installed without their scripts, in a Docker container with a read-only root, no capabilities and caps on memory, processors and processes; the bundler only reads them. What is downloaded stays on a Docker volume, never on the machine.
- **Made to be found and cited**: server-rendered pages with structured data and a share image, `sitemap.xml`, `llms.txt`, and a Markdown version of every measured package for AI agents (`/package/<name>.md` or `Accept: text/markdown`).
- **Accessible**: WCAG 2.2 AA, checked with axe-core in the browser tests; full keyboard use (`Ctrl`/`⌘ K` for the search), screen reader announcements, light and dark themes, reduced motion, and a table view of every chart's numbers.

### How it works

```
 ┌──────────────────────┐   /v1/analyses    ┌─────────────────────────┐   /internal/jobs   ┌─────────────────────────────┐
 │ frontend             │ ────────────────▶ │ backend                 │ ◀───────────────── │ worker (Docker only)        │
 │ TanStack Start (SSR) │                   │ Hono + SQLite + a queue │                    │ pnpm install --ignore-scripts│
 └──────────────────────┘                   └─────────────────────────┘                    │ rolldown, gzip, brotli       │
                                                                                           └───────────┬─────────────────┘
                                                                                                       │ downloads from
                                                                                                       ▼
                                                                                                  registry.npmjs.org
```

A package page asks the API for its analysis. The API answers from its store, or queues the package and answers "queued"; the worker, polling for work, downloads the package and its dependencies without running any of their scripts, bundles it, measures it and hands the result back. The page polls until the measurement is there. Only the worker ever touches a package; the API and the frontend never do.

#### Security and performance

- **Untrusted input, contained.** The worker runs only in Docker, with a read-only root filesystem, no Linux capabilities, no privilege gain and caps on memory, CPU and processes; it refuses to start anywhere else. Packages are installed with `--ignore-scripts` and never executed.
- **Fair use.** Every caller gets 300 requests a minute to `/v1/*`; queueing downloads (`POST /v1/history`) has a far smaller share, so a crawler cannot fill the queue by opening pages. The frontend's rendering proves itself with a token and is limited per visitor instead. `RateLimit-*` headers say where you stand; a `429` carries `Retry-After`.
- **Hardened pages.** A strict Content-Security-Policy that allows inline scripts only by hash and nonce, `frame-ancestors 'none'`, HSTS, `nosniff`, a strict referrer policy.
- **Supply chain.** Exact dependency versions, each at least 7 days old before pnpm installs it; transitive dependencies from the registry only; install scripts allowed one by one; Docker base images pinned by digest; GitHub Actions pinned to a commit; pnpm installed through Corepack and verified by its hash. `pnpm policy` fails when any of it slips.

#### Repository layout

```
apps/backend     HTTP API (Hono on Node 24), SQLite store of measurements and the job queue
apps/worker      The analyzer, run only in Docker: installs, bundles and measures one package at a time
apps/frontend    Web app (TanStack Start, Router, Query, Table, Charts; Tailwind; Nitro)
apps/e2e         Browser tests (Playwright) with an axe-core audit
packages/core    Shared contract (zod/mini schemas and types), package spec parsing
tools            Policy check, smoke test, .env initializer, oxlint plugin
```

| Technology                                                        | Used for                                                                 |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| TypeScript 7, Node 24, pnpm workspaces, Turborepo                 | One language end to end, exact dependency pins, 7-day release-age policy |
| Hono, `node:sqlite`, pino, zod                                    | API, storage and the job queue with no native dependency, logging        |
| rolldown                                                          | The bundler that measures a package                                      |
| React 19, TanStack Start / Router / Query / Table / Charts, Nitro | Server-rendered UI, URL-driven state, charts                             |
| Tailwind CSS 4, Base UI, Lucide                                   | Styling and accessible primitives                                        |
| oxlint, oxfmt, Vitest, Playwright, axe-core                       | Lint, format, unit tests, browser tests, accessibility audit             |

## Getting started

You need **Node 24.22.1** (see `.node-version`), **pnpm 12** (the exact version is pinned in `package.json` and fetched automatically) and **Docker**.

```bash
git clone https://github.com/janszotkowski/pkg-guard.git
cd pkg-guard
pnpm install
pnpm dev
```

`pnpm dev` creates the local `.env` files from the examples when they are missing (and never changes existing ones), starts the worker in Docker, and then the API and the frontend with reload.

| What    | Address                         |
| ------- | ------------------------------- |
| Web app | http://localhost:3100           |
| API     | http://127.0.0.1:4100/v1/health |

The worker stays idle until you look up a package, and then downloads that package and its dependencies from npm without running any of their scripts. They stay on a Docker volume, never on your machine. The worker keeps running after `pnpm dev` ends.

```bash
pnpm worker:logs    # what the worker is doing
pnpm worker:stop    # stop it, keeping what it downloaded
pnpm worker:clean   # stop it and delete everything it downloaded
```

`pnpm stack` runs the whole product the way production would (API, frontend and worker as containers, from the [`Dockerfile`](Dockerfile)); it needs real `WORKER_TOKEN` and `INTERNAL_API_TOKEN` values in the environment and `BACKEND_URL=http://api:4100` for the worker.

## Usage

The API is JSON over HTTP and works from a browser, a script or any HTTP client:

```bash
curl "http://127.0.0.1:4100/v1/analyses?package=react"
curl "http://127.0.0.1:4100/v1/analyses?package=react@19.1.0&known=1"
```

| Endpoint            | Returns                                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/health`    | `{ status, version }`                                                                                                                                                         |
| `GET /v1/analyses`  | The analysis of `package` (a name, optionally `@version` or `@tag`): queued, running, done or failed. `known=1` reads only what has been measured and never queues a download |
| `GET /v1/history`   | Every version of `package`, with the sizes of the measured ones                                                                                                               |
| `POST /v1/history`  | Queues every version of `package` to be measured (rate limited on its own, since each means a download)                                                                       |
| `GET /v1/downloads` | Downloads of `package` per day over `range`                                                                                                                                   |
| `GET /v1/metadata`  | What the registry says about `package@version`: licence, types, module format, scripts                                                                                        |
| `GET /v1/stars`     | GitHub stars of `repository` (`owner/name`)                                                                                                                                   |
| `GET /v1/search`    | Packages matching `q`                                                                                                                                                         |
| `GET /v1/packages`  | Every measured package (what the sitemap lists)                                                                                                                               |

Errors share one shape, `{ error: { code, message, requestId } }`, with codes `VALIDATION_FAILED`, `NOT_FOUND`, `RATE_LIMITED`, `UNAUTHORIZED`, `UNAVAILABLE` and `INTERNAL`. The response shapes are defined once, as zod schemas, in [`packages/core/src/contract`](packages/core/src/contract).

## Configuration

The backend reads its settings from the environment once at start-up and refuses to start with a readable message when one is invalid. The full list, with defaults, is in [`apps/backend/src/config/env.ts`](apps/backend/src/config/env.ts).

| Variable                                                            | Default                          | Meaning                                                                                                                                 |
| ------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`, `HOST`                                                      | `4100`, `127.0.0.1`              | Where the API listens (on Linux, the worker in Docker needs more than `127.0.0.1`)                                                      |
| `DATABASE_PATH`                                                     | `./data/pkg-guard.db`            | The SQLite file (created when missing); `:memory:` for tests                                                                            |
| `CORS_ORIGINS`                                                      | any localhost port (development) | Comma-separated origins of the frontend; required in production                                                                         |
| `WORKER_TOKEN`                                                      | none (required)                  | What the worker proves itself with (32+ characters); the example value is refused in production                                         |
| `INTERNAL_API_TOKEN`                                                | none                             | Shared with the frontend's server, so its rendering is limited per visitor (32+ characters); the example value is refused in production |
| `RATE_LIMIT_PER_MINUTE`                                             | `300`                            | Requests per caller per minute to `/v1/*` (health excepted)                                                                             |
| `RATE_LIMIT_RENDER_PER_MINUTE`                                      | `600`                            | Requests the frontend's rendering may make per minute for one visitor it names                                                          |
| `RATE_LIMIT_QUEUE_PER_MINUTE`                                       | `10`                             | Times one caller may queue a package's versions (`POST /v1/history`) per minute                                                         |
| `CLIENT_IP_HEADER`                                                  | connection address               | Single-value header the proxy overwrites with the visitor's address (`cf-connecting-ip`, `x-real-ip`); `x-forwarded-for` is refused     |
| `QUEUE_MAX_WAITING`                                                 | `200`                            | Packages waiting at most; beyond it the API answers `503`                                                                               |
| `JOB_LEASE_SECONDS`, `JOB_MAX_ATTEMPTS`, `JOB_FAILED_RETRY_MINUTES` | `180`, `2`, `60`                 | How long a worker may be silent about a job, how often a package is retried, and when a failed one is measured again                    |
| `GITHUB_TOKEN`                                                      | none                             | Optional, for the stars in the trends table (60 questions an hour without it; no permissions needed)                                    |
| `LOG_LEVEL`                                                         | `info`                           | pino log level                                                                                                                          |

The worker runs in Docker with the settings of [`docker-compose.yml`](docker-compose.yml); the full list is in [`apps/worker/src/config/env.ts`](apps/worker/src/config/env.ts): `BACKEND_URL`, `WORKER_TOKEN`, `WORKER_CONCURRENCY`, `JOB_TIMEOUT_MS`, `JOB_MEMORY_MB`, `MAX_INSTALL_BYTES`, `STORE_MAX_BYTES` and the like. `WORKER_IN_CONTAINER=true` must be set by the image; the worker refuses to run otherwise.

The frontend's settings are build-time (`VITE_*`, baked into the bundle) plus a few runtime variables for its server:

| Variable              | Meaning                                                                        |
| --------------------- | ------------------------------------------------------------------------------ |
| `VITE_API_URL`        | The API the browser calls (required for a build)                               |
| `VITE_SITE_URL`       | The public origin of the site (canonical links)                                |
| `VITE_ALLOW_INDEXING` | `true` only for the production build; everything else answers `noindex`        |
| `API_INTERNAL_URL`    | Runtime, server only: an internal address of the API for server-side rendering |
| `INTERNAL_API_TOKEN`  | Runtime, server only: the same token as the backend's                          |
| `CLIENT_IP_HEADER`    | Runtime, server only: the header with the visitor's address behind a proxy     |

## Documentation

- [How it's built](docs/ARCHITECTURE.md) describes one analysis end to end, how packages are handled safely, the rate limit, the documents for search engines and agents, the security headers and accessibility.
- [Roadmap](docs/ROADMAP.md) lists the features that come next; the [TODO](docs/TODO.md) what must be done before the first public release.
- [Security policy](SECURITY.md) explains how to report a vulnerability in pkg-guard.
- [AGENTS.md](AGENTS.md) spells out the conventions for coding agents (and people).

## Development

Use the commands below while developing or validating a change:

| Command          | What it does                                                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`       | Worker in Docker, then backend and frontend with reload (creates the `.env` files first)                                                                                                     |
| `pnpm build`     | Production build of every package                                                                                                                                                            |
| `pnpm test`      | Unit tests (Vitest), which download no packages                                                                                                                                              |
| `pnpm smoke`     | Starts the built backend and frontend as production runs them and checks that they work together (health, validation, rate-limit headers, documents, security headers, Markdown negotiation) |
| `pnpm e2e`       | Browser tests (Playwright) of the production builds, desktop and phone, with an axe-core audit; run `pnpm --filter @pkg-guard/e2e exec playwright install chromium` once first               |
| `pnpm typecheck` | TypeScript across the monorepo                                                                                                                                                               |
| `pnpm lint`      | oxlint, warnings fail                                                                                                                                                                        |
| `pnpm format`    | oxfmt (use `pnpm format:check` to only check)                                                                                                                                                |
| `pnpm policy`    | The dependency, toolchain, Docker and workflow rules below                                                                                                                                   |
| `pnpm verify`    | Everything CI runs before the browser tests: policy, lint, format check, typecheck, tests, build, smoke test                                                                                 |
| `pnpm stack`     | The whole product in Docker (`--profile app`); `pnpm stack:down` stops it                                                                                                                    |

### Checks and CI

`pnpm verify` runs everything CI runs, in the same order: the dependency and workflow policy (`pnpm policy`), lint, formatting, types, tests, the build and the smoke test. If it passes locally it passes in CI. CI (`.github/workflows/ci.yml`) then runs the browser tests, checks that the build changed no committed file (the generated route tree) and builds the three Docker images. Merging should require the **Verify** check to be green.

### Dependency rules

- pnpm, workspaces and Turborepo only.
- Every version in `package.json` is exact (no `^` or `~`); `savePrefix: ""` in `pnpm-workspace.yaml`.
- `minimumReleaseAge: 10080`: only versions older than 7 days are installed.
- `blockExoticSubdeps: true`: transitive dependencies come from the registry, never from a git repository or a tarball URL. `strictDepBuilds: true`: an install script that is not listed in `allowBuilds` fails the install instead of being skipped.
- `pnpm policy` (`tools/check-policy.js`) fails on a range in any `package.json` or in `overrides`, an unpinned package manager or runtime, a weakened `pnpm-workspace.yaml`, a Docker base image or Compose image that is not pinned by digest, a Dockerfile whose Node or pnpm differ from the project's, or a GitHub Action that is not pinned to a full SHA.

### Lint and format

One configuration for the whole monorepo in the root: `oxlint.config.ts` and `oxfmt.config.ts` (oxlint + oxfmt, no ESLint, Prettier or Biome). React and a11y rules apply to `apps/frontend` only.

#### Code style rules enforced by lint

- **Functions are `const`**, never declarations: `export const parseSpec = (value: string) => { … }`, not `export function parseSpec(value: string) { … }` (`eslint/func-style: expression`). Generators are the one shape an arrow cannot take, so they are written as function expressions: `const chunks = async function* (…) { … }`.
- **React components take one `props` parameter and read `props.x`**, never a destructured parameter list: `const ErrorState = (props: ErrorStateProps) => …`, not `({ error, reset }: ErrorStateProps) => …`. A component that forwards the rest to a primitive splits it off inside the body (`const { className, ...rest } = props`). Enforced by the project rules `pkgguard/no-destructured-component-props` and `pkgguard/no-inline-component-props-type` (`tools/oxlint-plugin.js`, an oxlint JS plugin).
- **Imports use path aliases, never `../`** and never `./folder/…`: `import { AppError } from '@platform/errors.ts'`. Only a sibling in the same folder (`./name`) may be relative. Every top-level folder of a package is an alias of the same name, plus `@src` and `@tests`:

    | Package         | Aliases (tsconfig `paths`)                                                 |
    | --------------- | -------------------------------------------------------------------------- |
    | `apps/backend`  | `@config` `@platform` `@modules` `@composition` `@src` `@tests`            |
    | `apps/worker`   | `@config` `@modules` `@src` `@tests`                                       |
    | `apps/frontend` | `@components` `@config` `@lib` `@routes` `@styles` `@src` `@tests` `@vite` |
    | `packages/core` | `@src` `@tests`, for tests only                                            |

    Vite, Vitest and tsdown resolve them from `tsconfig.json`; `tsc` too. Exceptions (the lint rule is off there): the config-time files (`vite.config.ts`, `vitest.config.ts`, `tsdown.config.ts`, `apps/frontend/vite/**`), which run before aliases exist, and `packages/core/src`, which other packages consume as source and which therefore cannot rely on its own aliases (it keeps relative imports).

- A `const` function is not hoisted: define it above the code that uses it at module load (for example a route component above `createFileRoute(...)`). TypeScript reports a violation as "used before its declaration".
- No `console` (use the logger), no `any`, `type` instead of `interface`, no unused variables or empty functions.
- `packages/core` reaches the browser: no `window`, `document`, `process` or `Buffer` there, and `zod/mini` instead of `zod`.

## Contributing

Contributions are welcome: bug reports, wrong measurements, new measurements, new views. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first; everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). Open an issue for a [bug](https://github.com/janszotkowski/pkg-guard/issues/new?template=bug_report.yml), a [wrong measurement](https://github.com/janszotkowski/pkg-guard/issues/new?template=wrong_measurement.yml) or a [feature request](https://github.com/janszotkowski/pkg-guard/issues/new?template=feature_request.yml).

## Security

To report a security problem in pkg-guard itself, follow the private reporting process in [SECURITY.md](SECURITY.md); never open a public issue for it. A vulnerability in a package that pkg-guard measured is not a pkg-guard issue: report it to that package's maintainers.

## License

[MIT](LICENSE) © Jan Szotkowski. pkg-guard measures packages as published on npm, without warranty of any kind; a package's own licence stays its own.
