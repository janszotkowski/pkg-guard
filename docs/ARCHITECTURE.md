# How it's built

pkg-guard is one TypeScript repository: a backend that stores what each npm package costs, a worker that measures packages, a server-rendered frontend, and a small package they share.

```
 browser ──▶ frontend (TanStack Start, SSR) ──/v1/*──▶ backend (Hono + SQLite)
                                                          ▲
                                     /internal/* + token  │  take a job, hand in the result
                                                          │
                                  worker ─── one process per package ───▶ npm registry
```

```
apps/backend     HTTP API, the store of results and the queue (one SQLite table)
apps/worker      Installs one package at a time, bundles it and reports its sizes
apps/frontend    Web app: search and the package page
packages/core    Shared contract: zod schemas, package name validation, the analyzer version
docs             This page
```

## One analysis

1. The page asks `GET /v1/analyses?package=react`. The backend resolves the name to an exact version and answers from the store, or queues the package.
2. The worker takes the job with `POST /internal/jobs/claim` and starts a process just for it.
3. That process installs the package, bundles it with Rolldown, compresses the bundle and answers with the numbers.
4. The worker hands in the result, and the page, asking every second, shows it.
5. The same process then bundles each entry point and each named export alone, and the page adds them when they arrive. Its folder is then removed.

The worker only handles what someone asked for. Nothing is fetched in the background. Suggestions while typing come from the registry's search through `GET /v1/search`: names and descriptions only, nothing is installed.

## Handling packages safely

A package is untrusted code. It is read, never run:

- **Only in Docker**: the worker refuses to start outside its container. Everything it downloads stays on the `worker-data` volume, and `pnpm worker:clean` removes it.
- **A hardened container**: a read-only filesystem, no capabilities, an unprivileged user, and limits on memory and processes.
- **No scripts**: `pnpm install --ignore-scripts`, and dependencies may come from the registry only (`blockExoticSubdeps`).
- **No code execution**: the bundler parses the code. Nothing imports or runs it.
- **No secrets**: the analysis process does not receive `WORKER_TOKEN`, the user-level npm and pnpm configuration is replaced by empty files, and the worker has no database.
- **Limits**: one process group per package, killed after `JOB_TIMEOUT_MS`, and a cap on installed bytes (`MAX_INSTALL_BYTES`).
- **Validated names**: a package name reaches URLs and paths only through `isValidPackageName`.

**Not there yet, and required before this runs on a public server:** limiting the worker's network to the npm registry, a rate limit on the API, and a Content-Security-Policy on the frontend.

## Measuring

- **The entry depends on the package**: ES modules are measured through `export *`, CommonJS through a namespace import. `export *` over CommonJS measures next to nothing.
- **Nothing to import is an answer**: a package whose entry cannot be resolved, such as a command-line tool, gets its install size and its commands, and no bundle size.
- **A suspicious result is a failure**: a bundle with nothing of the package in it fails the analysis instead of reporting a few bytes.
- **A package made for Node.js says so**: Node's own modules and native addons stay out of the bundle and are named on the page, and imports that fail deep in the dependencies, often optional ones, are counted there. The number is then not a browser size, and the page says that too.
- **Peer dependencies are not counted**: the app brings them anyway.
- **Parts are bundled alone**: an entry point from `exports` or one named export, each in its own bundle, up to `MAX_NAMED` and `PARTS_BUDGET_MS`. The page says what was left out. CommonJS gets no per-export numbers, because bundlers cannot drop parts of it reliably.
- **Results are versioned**: `ANALYZER_VERSION` in `packages/core` is part of a result's key. Bump it when the way of measuring changes.
