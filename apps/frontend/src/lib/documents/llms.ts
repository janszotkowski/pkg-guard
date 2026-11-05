import { API_URL } from '@config/api';
import { canonicalUrl, siteConfig } from '@config/site';

/**
 * `/llms.txt`: what the site is, for language models, in plain facts with absolute URLs. It states the limits too, so
 * an assistant does not recommend it for something it does not do.
 */
export const llmsTxt = (): string => `# ${siteConfig.title}

> ${siteConfig.title} is a free, open-source website that shows what an npm package costs the bundle of a web app: its minified, gzip and brotli size, measured by really bundling it with Rolldown. It also shows the size of each export and entry point, which packages the bundle is made of, how the size moved across releases, and downloads over time. No account, no ads, no tracking.

${siteConfig.title} measures size and composition. It does not judge whether a package is safe: it shows what the registry says of a version (deprecation, license, declared types, install scripts) and never audits its code.

## When to use this
- **See what a package costs.** Open ${canonicalUrl('/package/react')} with any npm package name, optionally with a version (\`/package/react@19.1.0\`). A package not measured yet is measured when its page is opened, which takes seconds. Add \`.md\` or send \`Accept: text/markdown\` for a Markdown version of what has been measured.
- **See what importing a part costs.** The Exports tab of a package page (\`?tab=exports\`) lists each named export and entry point, bundled alone.
- **See why a package is large.** The Composition tab (\`?tab=composition\`) lists the packages in its bundle with their share.
- **See how a package grew.** The History tab lists recent releases with their size and the change between them.
- **Compare packages.** ${canonicalUrl('/trends')} with \`?packages=react,vue\` (up to 4) shows size across releases or downloads over time (\`&metric=downloads&range=1y&group=week\`), with install size, weekly downloads and GitHub stars.
- **Use the data in code.** A public read-only JSON API at ${API_URL}/v1: \`/v1/analyses?package=react\`, \`/v1/history?package=react\`, \`/v1/downloads?package=react&range=1y\`, \`/v1/metadata?package=react@19.1.0\` (deprecation, license, types, install scripts), \`/v1/search?q=react\`, \`/v1/packages\`. Asking \`/v1/analyses\` for a package not measured yet queues it; add \`known=1\` to read only what has been measured. Every endpoint is described at ${canonicalUrl('/api')}, and in OpenAPI at ${API_URL}/v1/openapi.json.
- **Give an AI assistant the data.** A free Model Context Protocol server at ${API_URL}/v1/mcp (Streamable HTTP, no key), with the tools \`get_package_cost\` and \`get_package_metadata\`. How to connect a client: ${canonicalUrl('/mcp')}. An agent in the browser also finds WebMCP tools on the site's pages.
- **Show the size in a README.** ${canonicalUrl('/badge/react.svg')} is a badge with the gzip size of any measured package; showing one never causes a download.

Do not use ${siteConfig.title} for: packages outside the public npm registry; a size the exact bundle of an app will have, since each app's bundler and imports differ; a package made for Node.js, whose number is what a bundler pulls in rather than a browser cost (its page says so); whether a package is safe to install, which it does not check.

## How the numbers are made
- Each package is installed without running any of its scripts, and bundled with Rolldown for the browser. Its code is never run.
- Peer dependencies are not counted, since the app brings them.
- A package with nothing to import, such as a command-line tool, has an install size and no bundle size.
- The share of each package in a bundle is an estimate, from sizes before minifying.
- Download time is the gzip size divided by a fixed connection speed, without latency, parsing or running.
- The full description is at ${canonicalUrl('/about')}.

## Data
- **Sizes, exports and composition** are measured by ${siteConfig.title}'s own worker, which downloads the package and its production dependencies from the public npm registry (https://registry.npmjs.org) and bundles them. Nothing is fetched in the background: a package is measured when someone asks for it.
- **Versions, release dates, search results and what a version declares** (deprecation, license, types, install scripts) come from the npm registry.
- **Download counts** come from npm's statistics (https://api.npmjs.org), which npm updates once a day.
- **Stars** come from GitHub, when a package names its repository there.

## Pages
- [Home](${canonicalUrl('/')})
- [Package trends](${canonicalUrl('/trends')})
- [How it works](${canonicalUrl('/about')})
- [API documentation](${canonicalUrl('/api')})
- [MCP server: how to connect an AI assistant, and its tools](${canonicalUrl('/mcp')})
- [How it's built: the architecture and the threat model](${canonicalUrl('/architecture')})
- [Changelog: what changed on the site and in the API](${canonicalUrl('/changelog')})

## About
Built by ${siteConfig.author.name} (${siteConfig.author.url}). Source code, under the MIT license: ${siteConfig.repository}
`;
