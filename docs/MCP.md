# pkg-guard MCP server

pkg-guard is also a [Model Context Protocol](https://modelcontextprotocol.io) server, so an AI assistant can check what a dependency costs before adding it, instead of guessing from what it remembers. It reads the same data as the site and the [JSON API](API.md). It is free, with no key and no account.

The site is not deployed yet, so the address below is the one `pnpm dev` starts on your own machine.

```
http://127.0.0.1:4100/v1/mcp
```

## Connect a client

The server speaks Streamable HTTP, so a client needs only the address above.

**Claude Code**

```bash
claude mcp add --transport http pkg-guard http://127.0.0.1:4100/v1/mcp
```

**Cursor**, in `~/.cursor/mcp.json`:

```json
{
    "mcpServers": {
        "pkg-guard": { "url": "http://127.0.0.1:4100/v1/mcp" }
    }
}
```

**VS Code**, in `.vscode/mcp.json`:

```json
{
    "servers": {
        "pkg-guard": { "type": "http", "url": "http://127.0.0.1:4100/v1/mcp" }
    }
}
```

**Any other client**: give it the address, with no authentication. To try the tools by hand, run the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector
```

## What to ask

- "What would adding date-fns cost my bundle, compared with dayjs?"
- "Which export of lodash-es is the largest?"
- "Is this version of request deprecated, and what license does it have?"
- "Does this package run a script when it is installed?"

## Tools

Each answers JSON in the shapes of the [JSON API](API.md). `package` is a name, optionally with a version or tag: `react`, `react@19.1.0`, `react@next`.

| Tool                   | What it answers                                                                                                                                                  | Input     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `get_package_cost`     | Minified, gzip and brotli bytes, install size, composition and the size of each export; exports are cut to the first 25, with their total. See below for a package not measured yet | `package` |
| `get_package_metadata` | What the registry says of a version: deprecation, license, types and install scripts. Nothing is downloaded. Only this tool is marked read-only                   | `package` |

A package not measured yet is queued, as opening its page does, and `get_package_cost` answers `queued` or `running` with what to do: call again in a few seconds. So it is not marked read-only, though it changes nothing of yours: the package is downloaded on the server, and its code is never run.

A value a tool cannot read is answered with the problem, so an agent can correct itself.

## Good to know

- **Fair use.** Each message to the server is one request. It counts against the [rate limit](API.md#rate-limit-and-caching) of the API and against 60 requests a minute per address for this server, with 1,200 a minute for all callers together. The `RateLimit-*` headers report your share per address. Over any of the limits, the HTTP answer is `429` with `Retry-After`.
- **No open connections.** Every call is one request and one answer. The tools do not change while the server runs, so change notifications are not offered.
- **Text from package authors.** Descriptions, failure messages, licenses and deprecation notices come from the packages. A client should treat them as data, never as instructions; the server tells it so.
- **Not a safety check.** It shows sizes and what the registry says. It does not judge whether a package is safe to install.
- **In the browser.** The site's pages also offer [WebMCP](https://webmachinelearning.github.io/webmcp/) tools to an agent running in the browser: `search_packages`, `get_package_cost`, `get_package_metadata`, `get_version_history`, `get_downloads`, and `open_package` and `show_trends`, which move the page. This server is for every other client.
- **Calls from web pages.** A request with an `Origin` header the server does not know is refused with `403`. Programs send no such header.

## Self-hosting

The server is part of the backend: `POST /v1/mcp` on your own API host. Both the 2026-07-28 protocol revision and the 2025 ones are served, without sessions.

| Variable                          | Default | Meaning                                                              |
| --------------------------------- | ------- | -------------------------------------------------------------------- |
| `MCP_ENABLED`                     | `true`  | `false` answers `404` at `/v1/mcp`; the rest of the API is untouched |
| `RATE_LIMIT_MCP_PER_MINUTE`       | `60`    | Requests per caller per minute, on top of the general limit          |
| `RATE_LIMIT_MCP_TOTAL_PER_MINUTE` | `1200`  | Requests per minute for all callers together                         |
