/**
 * Creates the local `.env` files from the committed `.env.example` files, once.
 * An existing `.env` is never touched. Run by `pnpm env:init`; `.env` files are git-ignored.
 */
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const targets = ['apps/backend', 'apps/frontend'];

for (const target of targets) {
    const example = join(root, target, '.env.example');
    const env = join(root, target, '.env');
    if (!existsSync(example)) {
        process.stderr.write(`${target}: no .env.example to copy from\n`);
        process.exit(1);
    }
    if (existsSync(env)) {
        process.stdout.write(`${target}/.env already exists, left as it is\n`);
        continue;
    }
    copyFileSync(example, env);
    process.stdout.write(`${target}/.env created from .env.example\n`);
}
