import { builtinModules } from 'node:module';

const BUILTINS = new Set(builtinModules);

/** What a package reaches for that no browser has. */
export type NodeUse = { builtins: Set<string>; nativeAddons: Set<string> };

export type ExternalOptions = {
    peers: readonly string[];
    /** Whether a package of this name is installed: `events` or `buffer` from npm are real code, and bundled like any other. */
    isInstalled: (name: string) => boolean;
    use: NodeUse;
};

const packageRoot = (specifier: string): string => specifier.split('/')[0] ?? specifier;

/**
 * What stays out of the bundle. Peer dependencies, which the app brings anyway; and what cannot be bundled at all, Node's
 * own modules and native addons, which are noted so that the page can say this package is not made for a browser.
 */
export const createExternal =
    (options: ExternalOptions) =>
    (id: string): boolean => {
        if (id.endsWith('.node')) {
            options.use.nativeAddons.add(id);
            return true;
        }
        const prefixed = id.startsWith('node:');
        const bare = prefixed ? id.slice('node:'.length) : id;
        if (prefixed || (BUILTINS.has(packageRoot(bare)) && !options.isInstalled(packageRoot(bare)))) {
            options.use.builtins.add(packageRoot(bare));
            return true;
        }
        return options.peers.some((peer) => id === peer || id.startsWith(`${peer}/`));
    };

/**
 * A package that names something optional, often inside a `try`, still works without it, so an import that fails deep in
 * its dependencies is only counted. An import the entry itself cannot resolve means the package is not there to measure.
 */
export const isFatalUnresolved = (message: string): boolean => !message.includes('node_modules');
