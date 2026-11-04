import { gzip as gzipCallback, brotliCompress as brotliCallback, constants } from 'node:zlib';
import { promisify } from 'node:util';
import { rolldown, VERSION } from 'rolldown';
import { AnalysisError } from './failure.ts';

const gzip = promisify(gzipCallback);
const brotli = promisify(brotliCallback);

export const BUNDLER = { name: 'rolldown', version: VERSION };

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The bundle's files. Only the bundler reads the package here: it parses the code and never runs it. An import that
 * cannot be resolved is a failure, not a smaller number, and so is a bundle with nothing of the package in it: both would
 * otherwise show a few bytes as if that were the package's real size.
 */
export const bundle = async (entry: string, cwd: string, peers: readonly string[]): Promise<Buffer[]> => {
    const unresolved: string[] = [];
    let files: Buffer[];
    let modules: string[];
    try {
        const build = await rolldown({
            input: entry,
            cwd,
            platform: 'browser',
            external: peers.map((peer) => new RegExp(`^${escapeRegExp(peer)}(?:/|$)`)),
            transform: { define: { 'process.env.NODE_ENV': '"production"' } },
            onLog: (_level, log) => {
                if (log.code === 'UNRESOLVED_IMPORT') unresolved.push(log.message);
            },
        });
        const { output } = await build.generate({ format: 'esm', minify: true });
        await build.close();
        files = output.map((file) => {
            if (file.type === 'chunk') return Buffer.from(file.code);
            return typeof file.source === 'string' ? Buffer.from(file.source) : Buffer.from(file.source);
        });
        modules = output.flatMap((file) => (file.type === 'chunk' ? Object.keys(file.modules) : []));
    } catch (error) {
        throw new AnalysisError('BUNDLE_FAILED', error instanceof Error ? error.message : String(error));
    }
    if (unresolved.length > 0) throw new AnalysisError('BUNDLE_FAILED', unresolved.join('\n'));
    if (!modules.some((id) => id.includes('node_modules'))) throw new AnalysisError('BUNDLE_FAILED', 'The bundle contains nothing of the package');
    return files;
};

/** Compression runs on libuv's threads, so it does not hold up the process. Each file is compressed on its own, as a server would send it. */
export const compress = async (files: readonly Buffer[]): Promise<{ minified: number; gzip: number; brotli: number }> => {
    const [gzipped, brotlied] = await Promise.all([
        Promise.all(files.map((file) => gzip(file, { level: 9 }))),
        Promise.all(files.map((file) => brotli(file, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: file.length } }))),
    ]);
    const total = (buffers: readonly Buffer[]): number => buffers.reduce((sum, buffer) => sum + buffer.length, 0);
    return { minified: total(files), gzip: total(gzipped), brotli: total(brotlied) };
};
