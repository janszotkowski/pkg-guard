# pkg-guard

**What an npm package really costs your bundle, free and open source.** Search for a package and see its minified, gzip and brotli sizes and what it puts on disk, measured with a modern bundler. The package's code is never run.

> Early work in progress. It runs locally only; see [How it's built](docs/ARCHITECTURE.md), including what is still required before a public deployment.

## Run it locally

You need Node 24, pnpm 12 and Docker.

```bash
pnpm install
pnpm dev
```

`pnpm dev` creates the local `.env` files from the examples when they are missing, and never changes existing ones.

- Frontend: http://localhost:3100
- API: http://127.0.0.1:4100/v1/health

`pnpm dev` also starts the worker in Docker. It stays idle until you look up a package, and then downloads that package and its dependencies from npm without running any of their scripts. They stay on a Docker volume, never on your machine, and the worker refuses to run outside Docker. The worker keeps running after `pnpm dev` ends.

```bash
pnpm worker:logs    # what the worker is doing
pnpm worker:stop    # stop it, keeping what it downloaded
pnpm worker:clean   # stop it and delete everything it downloaded
```

## Commands

```bash
pnpm verify      # policy, lint, format, types, tests and build: the same as CI
pnpm test        # unit tests, which download no packages
pnpm typecheck
pnpm lint
pnpm format
```

## License

[MIT](LICENSE)
