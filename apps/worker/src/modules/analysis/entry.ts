/** The parts of a package's `package.json` the analysis reads. */
export type Manifest = { type?: unknown; module?: unknown; exports?: unknown; peerDependencies?: unknown };

const hasImportCondition = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(hasImportCondition);
    if (typeof value !== 'object' || value === null) return false;
    return Object.entries(value).some(([key, inner]) => key === 'import' || hasImportCondition(inner));
};

export const isEsm = (manifest: Manifest): boolean => manifest.type === 'module' || typeof manifest.module === 'string' || hasImportCondition(manifest.exports);

/**
 * The module the bundler starts from. `export *` keeps an ES module's tree-shaking but measures next to nothing over
 * CommonJS, whose exports a bundler cannot see. A namespace kept alive measures CommonJS correctly and ES modules too
 * large, because it has to build the namespace object.
 */
export const entrySource = (name: string, manifest: Manifest): { kind: 'export-star' | 'namespace'; code: string } => {
    const specifier = JSON.stringify(name);
    return isEsm(manifest) ? { kind: 'export-star', code: `export * from ${specifier};\n` } : { kind: 'namespace', code: `import * as all from ${specifier};\nglobalThis.__pkgGuard = all;\n` };
};

/** Peer dependencies stay out of the measured bundle: the app brings them anyway. */
export const peerNames = (manifest: Manifest): string[] => (typeof manifest.peerDependencies === 'object' && manifest.peerDependencies !== null ? Object.keys(manifest.peerDependencies) : []);
