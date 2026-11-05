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
apps/frontend    Web app: search, the package page, trends and how it works
packages/core    Shared contract: zod schemas, package name validation, the analyzer version
docs             This page
```

## One analysis

1. The page asks `GET /v1/analyses?package=react`. The backend resolves the name to an exact version and answers from the store, or queues the package.
2. The worker takes the job with `POST /internal/jobs/claim` and starts a process just for it.
3. That process installs the package, bundles it with Rolldown, compresses the bundle and answers with the numbers.
4. The worker hands in the result, and the page, which keeps asking, shows it.
5. The same process then bundles each entry point and each named export alone, and the page adds them when they arrive. Its folder is then removed.

The worker only handles what someone asked for. Nothing is fetched in the background: older versions of a package are measured only when someone looks at them, on a package's History tab or in the size view of the trends page, behind anything someone is waiting for. Suggestions while typing come from the registry's search through `GET /v1/search`: names and descriptions only, nothing is installed. The package health panel reads the registry's document of the version through `GET /v1/metadata`, so nothing is installed for it either, and it is not stored with the result, because a version can be deprecated after it was measured.

## Opening a package

Going to a package inside the app never waits: the page opens at once and asks for the size, and history and package health follow without holding anything up. Only the server waits for the first answer, so that a page loaded from its address and read by a crawler arrives complete. What a name or tag resolved to is kept for a minute, because every package page starts with that question to the registry.

## Handling packages safely

A package is untrusted code. It is read, never run:

- **Only in Docker**: the worker refuses to start outside its container. Everything it downloads stays on the `worker-data` volume, and `pnpm worker:clean` removes it.
- **A hardened container**: a read-only filesystem, no capabilities, an unprivileged user, and limits on memory and processes.
- **No scripts**: `pnpm install --ignore-scripts`, and dependencies may come from the registry only (`blockExoticSubdeps`).
- **No code execution**: the bundler parses the code. Nothing imports or runs it.
- **No secrets**: the analysis process does not receive `WORKER_TOKEN`, the user-level npm and pnpm configuration is replaced by empty files, and the worker has no database.
- **Limits**: one process group per package, killed after `JOB_TIMEOUT_MS`, and a cap on installed bytes (`MAX_INSTALL_BYTES`).
- **Validated names**: a package name reaches URLs and paths only through `isValidPackageName`.

**Not there yet, and required before this runs on a public server:** limiting the worker's network to the npm registry, and a rate limit on the API, which crawlers opening pages of unmeasured packages would otherwise use to queue downloads.

## Search engines and agents

- **One head for every page**: `pageHead` builds the title, description, canonical address, Open Graph and Twitter cards, and one JSON-LD graph.
- **What is indexed**: the home page, the trends page, the how-it-works page and measured packages at their own address. A package still being measured, a page of one version and a chosen comparison are kept out, and so is every page outside production (`VITE_ALLOW_INDEXING`).
- **Documents**: `robots.txt`, `sitemap.xml`, `llms.txt`, `.well-known/security.txt` and `.well-known/ai-catalog.json`, share images at `/og/`, and each package as Markdown (`.md`, or `Accept: text/markdown`), all from `src/server.ts`.
- **Reading never downloads**: documents and share images ask the API with `known=1`, so a crawler following them cannot cause a package to be measured.

## Security headers

Every response gets the security headers, and each page a Content-Security-Policy built from the hashes of its own inline scripts, never `'unsafe-inline'`. None of it applies to the dev server, whose hot reload a strict policy would block.

## Accessibility

Keyboard reachable with a skip link and visible focus, labelled controls, tables with real headers, reduced motion respected, and after each navigation the new page's title is announced and focus moves to it.

## Measuring

- **The entry depends on the package**: ES modules are measured through `export *`, CommonJS through a namespace import. `export *` over CommonJS measures next to nothing.
- **Nothing to import is an answer**: a package whose entry cannot be resolved, such as a command-line tool, gets its install size and its commands, and no bundle size.
- **A suspicious result is a failure**: a bundle with nothing of the package in it fails the analysis instead of reporting a few bytes.
- **A package made for Node.js says so**: Node's own modules and native addons stay out of the bundle and are named on the page, and imports that fail deep in the dependencies, often optional ones, are counted there. The number is then not a browser size, and the page says that too.
- **Peer dependencies are not counted**: the app brings them anyway.
- **Composition is an estimate**: the bundler reports each module's size before minifying, so the page shows each package's share of the bundle and works out its minified size from that.
- **Parts are bundled alone**: an entry point from `exports` or one named export, each in its own bundle, up to `MAX_NAMED` and `PARTS_BUDGET_MS`. The page says what was left out. CommonJS gets no per-export numbers, because bundlers cannot drop parts of it reliably.
- **Download time is arithmetic**: the gzip size at a fixed speed for each connection, without latency, parsing or running. A package made for Node.js does not get one.
- **Results are versioned**: `ANALYZER_VERSION` in `packages/core` is part of a result's key. Bump it when the way of measuring changes.
