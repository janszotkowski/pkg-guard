# Roadmap

Features that come next, in the order they are planned. Tick an item when it lands. Sizes are rough estimates: **XS**, **S**, **M**. What must be done before the first public release is in the [TODO](TODO.md).

## 1. First: quick differences on the package page

These download nothing extra and show a difference straight away.

- [x] **Download time (XS)**: the size as a time on 3G and 4G.
- [x] **Package health panel (S–M)**: deprecated, licence, TypeScript types, ESM or CommonJS, last release and install scripts in one place. It also makes room for the security data of section 4.
- [ ] **Why a version grew (S–M)**: compare the composition of two versions, such as "+12 kB, `lodash` was added". Each version already stores its composition.

## 2. Next: the rest of the package tools

- [x] **README badge (S)**: an SVG with the package's size, linking back to its page. It reads with `known=1`, so showing one never causes a download.
- [ ] **Cost of a specific import (M)**: measure `import { a, b } from 'x'` as one bundle. Adding up the exports is wrong, because they share code.
- [ ] **Similar packages (M)**: point to lighter replacements, such as `moment` to `dayjs`. The list is curated and has to be kept up by hand.
- [ ] **`package.json` scan (M)**: paste the file and see which dependencies cost the most. It can queue many downloads at once, so it needs a share of the rate limit of its own.

## 3. Outside the website

These reach people once the API is public, see the [TODO](TODO.md). Until then they work against a local one.

- [ ] **GitHub Action (M)**: a pull request comment such as "this change adds 34 kB", with an optional size limit.
- [x] **CLI (S–M)**: `pkg-guard react` prints the result in the terminal. Publishing it is in the [TODO](TODO.md).
- [ ] **MCP server (S)**: an AI agent checks what a dependency costs before adding it. Built on the existing API.

## 4. Security and CVE Tracker

- [ ] **Known vulnerabilities by version**, from CVE Tracker.
- [ ] **Risk changes between versions**: a new install script, a new dependency, a change of maintainer.
- [ ] **Provenance**: whether the package's build has a verified origin.
