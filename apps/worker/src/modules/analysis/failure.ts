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

const MAX_MESSAGE = 500;

/** What leaves this machine: local paths are removed and the length is capped, since tools quote files and packages in their errors. */
export const toFailure = (error: unknown, workDir: string): AnalysisFailure => {
    const message = (error instanceof Error ? error.message : String(error)).replaceAll(workDir, '').trim().slice(0, MAX_MESSAGE);
    return { code: error instanceof AnalysisError ? error.code : 'INTERNAL', message: message === '' ? 'The analysis failed' : message };
};
