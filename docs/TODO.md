# TODO

Must be done before the first public release. Features are in the [roadmap](ROADMAP.md).

- [ ] **Limit the worker's network** to the npm registry, see [How it's built](ARCHITECTURE.md#handling-packages-safely).
- [x] **Rate limit on the API**, which crawlers opening pages of unmeasured packages would otherwise use to queue downloads. See [How it's built](ARCHITECTURE.md#rate-limit).
- [ ] **Deploy** on our own server.
- [x] **Update `llms.txt`**, which now says that pkg-guard does not check whether a package is safe.
