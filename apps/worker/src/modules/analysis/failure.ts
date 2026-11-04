import type { AnalysisFailure } from '@pkg-guard/core';

/** A failure with a code the backend stores and the page explains. */
export class AnalysisError extends Error {
    readonly code: AnalysisFailure['code'];

    constructor(code: AnalysisFailure['code'], message: string) {
        super(message);
        this.name = 'AnalysisError';
        this.code = code;
    }
}

/** The package has nothing that can be imported, such as a command-line tool. That is an answer, not a failure. */
export class NoEntryError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NoEntryError';
    }
}

const MAX_MESSAGE = 500;

// oxlint-disable-next-line no-control-regex -- terminal colors are exactly what this removes.
const TERMINAL_CODES = /\u001b\[[0-9;]*[A-Za-z]/g;

/**
 * What leaves this machine: terminal colors and local paths are removed and the length is capped, since tools color their
 * errors and quote files in them. `/private` is where macOS really keeps `/var`.
 */
export const toFailure = (error: unknown, workDir: string): AnalysisFailure => {
    const message = (error instanceof Error ? error.message : String(error))
        .replace(TERMINAL_CODES, '')
        .replaceAll(`/private${workDir}/`, '')
        .replaceAll(`${workDir}/`, '')
        .replaceAll(workDir, '')
        .trim()
        .slice(0, MAX_MESSAGE);
    return { code: error instanceof AnalysisError ? error.code : 'INTERNAL', message: message === '' ? 'The analysis failed' : message };
};
