# TODO

Must be done before the first public release. Features are in the [roadmap](ROADMAP.md).

- [x] **Limit the worker's network** to the npm registry, see [How it's built](ARCHITECTURE.md#handling-packages-safely).
- [x] **Rate limit on the API**, which crawlers opening pages of unmeasured packages would otherwise use to queue downloads. See [How it's built](ARCHITECTURE.md#rate-limit).
- [ ] **Deploy** on our own server.
- [ ] **Give the CLI the public API** as its default (`DEFAULT_API_URL` in `apps/cli/src/cli.ts`) once it is deployed.
- [ ] **Publish the CLI** on npm. `pkg-guard` is taken there by an unrelated package, so it needs another name first; it is `@pkg-guard/cli` and private until then.
- [x] **Update `llms.txt`**, which now says that pkg-guard does not check whether a package is safe.
