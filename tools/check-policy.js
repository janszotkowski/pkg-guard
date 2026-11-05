/**
 * Checks the rules of the repository that nothing else enforces, and fails with a list of
 * what is wrong. Run by `pnpm policy` (part of `pnpm verify` and of CI).
 *
 * - every dependency in every package.json is an exact version (no ^, ~, ranges, tags),
 *   except workspace links
 * - the package manager and the runtime are pinned and agree with each other
 * - pnpm-workspace.yaml keeps the 7-day release age, exact saving, strict engines, registry-only transitive
 *   dependencies, strict install scripts and exact overrides
 * - the Dockerfile uses the same Node and pnpm versions (pnpm through Corepack, or `npm install --global pnpm@x.y.z`),
 *   and its base images are pinned by digest
 * - every image docker-compose.yml pulls is pinned by digest
 * - the worker stays on a network with no route out of Docker
 * - every GitHub Action is pinned to a full commit SHA
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const problems = [];

const read = (path) => readFileSync(join(root, path), 'utf8');
const readJson = (path) => JSON.parse(read(path));

const EXACT_VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies'];

const packageFiles = ['package.json'];
for (const group of ['apps', 'packages']) {
    if (!existsSync(join(root, group))) continue;
    for (const name of readdirSync(join(root, group))) {
        const file = `${group}/${name}/package.json`;
        if (existsSync(join(root, file))) packageFiles.push(file);
    }
}

// 1. Exact dependency versions.
for (const file of packageFiles) {
    const manifest = readJson(file);
    for (const field of DEPENDENCY_FIELDS) {
        for (const [name, version] of Object.entries(manifest[field] ?? {})) {
            if (version.startsWith('workspace:') || EXACT_VERSION.test(version)) continue;
            problems.push(`${file}: ${field}.${name} is "${version}", not an exact version`);
        }
    }
}

// 2. The package manager and the runtime are pinned and consistent.
const rootManifest = readJson('package.json');
const packageManager = rootManifest.packageManager ?? '';
// The hash after the version is what Corepack checks the download against.
const packageManagerVersion = /^pnpm@(\d+\.\d+\.\d+)(\+sha512\.[0-9a-f]+)?$/.exec(packageManager)?.[1];
if (packageManagerVersion === undefined) problems.push(`package.json: packageManager is "${packageManager}", expected "pnpm@x.y.z"`);

const devEngines = rootManifest.devEngines ?? {};
if (devEngines.packageManager?.version !== packageManagerVersion) problems.push('package.json: devEngines.packageManager.version does not match packageManager');
const runtime = devEngines.runtime?.version ?? '';
if (!EXACT_VERSION.test(runtime)) problems.push(`package.json: devEngines.runtime.version is "${runtime}", expected an exact version`);
const nodeVersionFile = existsSync(join(root, '.node-version')) ? read('.node-version').trim() : '';
if (nodeVersionFile !== runtime) problems.push(`.node-version is "${nodeVersionFile}" but devEngines.runtime.version is "${runtime}"`);

// The Dockerfile builds with the same Node and pnpm, and every base image is pinned by digest.
if (existsSync(join(root, 'Dockerfile'))) {
    const dockerfile = read('Dockerfile');
    const stages = new Set([...dockerfile.matchAll(/^FROM\s+\S+\s+AS\s+(\S+)/gim)].map((match) => match[1]));
    for (const [, image] of dockerfile.matchAll(/^FROM\s+(\S+)/gim)) {
        if (stages.has(image)) continue;
        if (!/@sha256:[0-9a-f]{64}$/.test(image)) problems.push(`Dockerfile: base image "${image}" is not pinned by digest`);
        const node = /^node:(\d+\.\d+\.\d+)-/.exec(image);
        if (node !== null && node[1] !== nodeVersionFile) problems.push(`Dockerfile: base image is Node ${node[1]} but .node-version is "${nodeVersionFile}"`);
    }
    // pnpm comes either through Corepack, which reads (and verifies) the version from package.json's `packageManager`
    // and needs the manifest copied in first, or from npm with the version written out, which must then be the same one.
    const corepack = /\bcorepack\s+(?:enable\b.*&&\s*corepack\s+)?install\b/.test(dockerfile);
    const copiesManifest = /^COPY\s+(?:--\S+\s+)*package\.json\b/m.test(dockerfile);
    const pnpm = [...dockerfile.matchAll(/npm install --global pnpm@(\S+)/g)].map((match) => match[1]);
    if (corepack) {
        if (!copiesManifest) problems.push('Dockerfile: installs pnpm through Corepack but never copies package.json, which carries the version it installs');
        if (!packageManager.includes('+sha512.'))
            problems.push("Dockerfile: installs pnpm through Corepack, so package.json's packageManager needs the +sha512 hash Corepack verifies the download with");
    } else if (pnpm.length === 0) {
        problems.push('Dockerfile: installs pnpm neither through Corepack nor with `npm install --global pnpm@x.y.z`');
    }
    for (const version of pnpm) {
        if (version !== packageManagerVersion) problems.push(`Dockerfile: installs pnpm@${version} but packageManager is "${packageManager}"`);
    }
}

// Images Compose pulls (not the ones it builds here) are pinned by digest: a re-pushed tag cannot change what runs.
for (const file of ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']) {
    if (!existsSync(join(root, file))) continue;
    read(file)
        .split('\n')
        .forEach((line, index) => {
            const image = /^\s*image:\s*['"]?([^'"#\s]+)/.exec(line);
            if (image === null) return;
            // A service that is built here names its image to share it with another service; it comes from no registry.
            if (!image[1].includes('/') && !image[1].includes(':') && !image[1].includes('@')) return;
            if (!/@sha256:[0-9a-f]{64}$/.test(image[1])) problems.push(`${file}:${index + 1}: image "${image[1]}" is not pinned by digest`);
        });
}

// The worker handles untrusted packages: its only network has no route out, and nothing publishes a port of it.
const compose = read('docker-compose.yml');
const workerService = /^ {4}worker:\n((?: {8}.*\n|\s*\n)*)/m.exec(compose)?.[1] ?? '';
if (!/^ {8}networks: \[analysis\]$/m.test(workerService)) problems.push('docker-compose.yml: the worker must be on the `analysis` network and no other');
if (/^ {8}(?:ports|extra_hosts|network_mode):/m.test(workerService)) problems.push('docker-compose.yml: the worker may have no ports, extra_hosts or network_mode');
if (!/^networks:\n(?:.*\n)*? {4}analysis:\n {8}internal: true$/m.test(compose)) problems.push('docker-compose.yml: the `analysis` network must be `internal: true`');

// 3. pnpm's own settings.
const workspace = read('pnpm-workspace.yaml');
const releaseAge = /^minimumReleaseAge:\s*(\d+)\s*$/m.exec(workspace);
if (releaseAge === null || Number(releaseAge[1]) < 10080) problems.push('pnpm-workspace.yaml: minimumReleaseAge must be at least 10080 (7 days)');
if (!/^savePrefix:\s*(""|'')\s*$/m.test(workspace)) problems.push('pnpm-workspace.yaml: savePrefix must be ""');
if (!/^engineStrict:\s*true\s*$/m.test(workspace)) problems.push('pnpm-workspace.yaml: engineStrict must be true');
if (!/^blockExoticSubdeps:\s*true\s*$/m.test(workspace)) problems.push('pnpm-workspace.yaml: blockExoticSubdeps must be true (transitive dependencies from the registry only)');
if (!/^strictDepBuilds:\s*true\s*$/m.test(workspace)) problems.push('pnpm-workspace.yaml: strictDepBuilds must be true (an unlisted install script fails the install)');
// An override is a version too: a range there would reopen what the exact versions close.
const overrides = /^overrides:\s*\n((?:[ \t]+\S.*\n?)*)/m.exec(workspace)?.[1] ?? '';
for (const line of overrides.split('\n')) {
    const entry = /^\s+(['"]?)(\S+?)\1:\s*(['"]?)([^'"#]*?)\3\s*(?:#.*)?$/.exec(line);
    if (entry === null) continue;
    if (!entry[4].startsWith('workspace:') && !EXACT_VERSION.test(entry[4])) problems.push(`pnpm-workspace.yaml: overrides.${entry[2]} is "${entry[4]}", not an exact version`);
}

// 4. Every action in every workflow is pinned to a full commit SHA.
const workflowDir = join(root, '.github/workflows');
if (existsSync(workflowDir)) {
    for (const file of readdirSync(workflowDir)) {
        if (!/\.ya?ml$/.test(file)) continue;
        const lines = readFileSync(join(workflowDir, file), 'utf8').split('\n');
        lines.forEach((line, index) => {
            const used = /^\s*(?:-\s+)?uses:\s*(\S+)/.exec(line);
            if (used === null || used[1].startsWith('./')) return;
            if (!/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(used[1])) problems.push(`.github/workflows/${file}:${index + 1}: "${used[1]}" is not pinned to a full commit SHA`);
        });
    }
}

if (problems.length > 0) {
    process.stderr.write(`Policy check failed:\n${problems.map((problem) => `  - ${problem}`).join('\n')}\n`);
    process.exit(1);
}
process.stdout.write(`Policy check passed (${packageFiles.length} manifests, pnpm-workspace.yaml, Dockerfile, Compose, workflows).\n`);
