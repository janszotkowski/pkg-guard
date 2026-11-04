/**
 * Checks the rules of the repository that nothing else enforces, and fails with a list of
 * what is wrong. Run by `pnpm policy` (part of `pnpm verify` and of CI).
 *
 * - every dependency in every package.json is an exact version (no ^, ~, ranges, tags),
 *   except workspace links
 * - the package manager and the runtime are pinned and agree with each other
 * - pnpm-workspace.yaml keeps the 7-day release age, exact saving and strict engines
 * - the Dockerfile uses the same Node and pnpm versions, and its base images are pinned by digest
 * - every GitHub Action is pinned to a full commit SHA
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
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
    const pnpm = /npm install --global pnpm@(\S+)/.exec(dockerfile);
    if (pnpm === null || pnpm[1] !== packageManagerVersion) problems.push(`Dockerfile: installs pnpm@${pnpm?.[1] ?? '?'} but packageManager is "${packageManager}"`);
}

// 3. pnpm's own settings.
const workspace = read('pnpm-workspace.yaml');
const releaseAge = /^minimumReleaseAge:\s*(\d+)\s*$/m.exec(workspace);
if (releaseAge === null || Number(releaseAge[1]) < 10080) problems.push('pnpm-workspace.yaml: minimumReleaseAge must be at least 10080 (7 days)');
if (!/^savePrefix:\s*(""|'')\s*$/m.test(workspace)) problems.push('pnpm-workspace.yaml: savePrefix must be ""');
if (!/^engineStrict:\s*true\s*$/m.test(workspace)) problems.push('pnpm-workspace.yaml: engineStrict must be true');

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
process.stdout.write(`Policy check passed (${packageFiles.length} manifests, pnpm-workspace.yaml, workflows).\n`);
