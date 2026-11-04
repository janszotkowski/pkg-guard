/** The parts of a package's `package.json` the analysis reads. */
export type Manifest = { type?: unknown; module?: unknown; exports?: unknown; peerDependencies?: unknown; sideEffects?: unknown; repository?: unknown; description?: unknown; bin?: unknown };

export type Entry = { kind: 'export-star' | 'namespace'; code: string };

const hasImportCondition = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(hasImportCondition);
    if (typeof value !== 'object' || value === null) return false;
    return Object.entries(value).some(([key, inner]) => key === 'import' || key === 'module' || hasImportCondition(inner));
};

export const isEsm = (manifest: Manifest): boolean => manifest.type === 'module' || typeof manifest.module === 'string' || hasImportCondition(manifest.exports);

/**
 * `export *` keeps an ES module's tree-shaking but measures next to nothing over CommonJS, whose exports a bundler cannot
 * see. A namespace kept alive measures CommonJS correctly and ES modules too large, because it has to build the namespace object.
 */
const entryFor = (specifier: string, esm: boolean): Entry => {
    const quoted = JSON.stringify(specifier);
    return esm ? { kind: 'export-star', code: `export * from ${quoted};\n` } : { kind: 'namespace', code: `import * as all from ${quoted};\nglobalThis.__pkgGuard = all;\n` };
};

/** The module the bundler starts from to measure a whole package. */
export const entrySource = (name: string, manifest: Manifest): Entry => entryFor(name, isEsm(manifest));

/** Peer dependencies stay out of the measured bundle: the app brings them anyway. */
export const peerNames = (manifest: Manifest): string[] => (typeof manifest.peerDependencies === 'object' && manifest.peerDependencies !== null ? Object.keys(manifest.peerDependencies) : []);

const COMMAND = /^[\w@.-]{1,100}$/;
const MAX_COMMANDS = 10;

/** The commands a package installs: `bin` as an object names them, and as a text it is one named after the package, without its scope. */
export const commandsOf = (packageName: string, manifest: Manifest): string[] => {
    const { bin } = manifest;
    const names = typeof bin === 'string' ? [packageName.split('/').at(-1) ?? packageName] : typeof bin === 'object' && bin !== null ? Object.keys(bin) : [];
    return names.filter((name) => COMMAND.test(name)).slice(0, MAX_COMMANDS);
};

const MAX_DESCRIPTION = 300;

/** What its author wrote, when that is usable text. */
export const descriptionOf = (manifest: Manifest): string | null => {
    const text = typeof manifest.description === 'string' ? manifest.description.trim() : '';
    return text === '' ? null : text.slice(0, MAX_DESCRIPTION);
};

/** Only a plain name goes into generated code, which also leaves out `default` (not part of `export *`) and quoted export names. */
const IDENTIFIER = /^[A-Za-z_$][\w$]{0,199}$/;

export const importableNames = (names: readonly string[]): string[] => [...new Set(names.filter((name) => IDENTIFIER.test(name) && name !== 'default'))].sort();

/** The module that imports one export alone: what is left after tree-shaking is what that import costs. */
export const namedEntry = (name: string, exportName: string): string => `export { ${exportName} } from ${JSON.stringify(name)};\n`;

/** The order a browser bundler picks a condition in. `types` points at no code. */
const CONDITIONS = ['browser', 'import', 'module', 'default', 'require', 'node'] as const;

const SUBPATH = /^\.\/[\w@./-]{1,200}$/;
const CODE_FILE = /\.(?:m?js|cjs|jsx)$/;

const targetFile = (value: unknown): string | undefined => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        for (const inner of value) {
            const found = targetFile(inner);
            if (found !== undefined) return found;
        }
        return undefined;
    }
    if (typeof value !== 'object' || value === null) return undefined;
    const conditions = value as Record<string, unknown>;
    for (const condition of CONDITIONS) {
        const found = targetFile(conditions[condition]);
        if (found !== undefined) return found;
    }
    return undefined;
};

export type Subpath = { path: string; entry: Entry };

/**
 * The paths a package offers in `exports`, other than its root, that lead to code. A wildcard stands for any number of
 * files, so it is only counted; stylesheets, JSON and the like are not JavaScript to measure.
 */
export const subpathsOf = (name: string, manifest: Manifest): { subpaths: Subpath[]; patterns: number } => {
    const map = manifest.exports;
    if (typeof map !== 'object' || map === null || Array.isArray(map)) return { subpaths: [], patterns: 0 };
    const subpaths: Subpath[] = [];
    let patterns = 0;
    for (const [path, value] of Object.entries(map)) {
        if (path === '.' || !path.startsWith('./')) continue;
        if (path.includes('*')) {
            patterns++;
            continue;
        }
        const file = targetFile(value);
        if (!SUBPATH.test(path) || file === undefined || !CODE_FILE.test(file)) continue;
        const esm = !file.endsWith('.cjs') && (file.endsWith('.mjs') || manifest.type === 'module' || hasImportCondition(value));
        subpaths.push({ path, entry: entryFor(`${name}${path.slice(1)}`, esm) });
    }
    return { subpaths, patterns };
};
