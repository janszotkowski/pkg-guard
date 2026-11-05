#!/usr/bin/env node
import { run } from './cli.ts';

process.exitCode = await run(process.argv.slice(2), {
    fetch,
    env: process.env,
    out: (text) => process.stdout.write(text),
    err: (text) => process.stderr.write(text),
});
