import { analyze } from '@modules/analysis/analyze.ts';
import { toFailure } from '@modules/analysis/failure.ts';
import type { AnalyzeOutcome, AnalyzeRequest } from '@modules/analysis/protocol.ts';

/** The process of one analysis (`runner.ts`): takes one request, answers once and ends. */
process.once('message', (message) => {
    const request = message as AnalyzeRequest;
    void analyze(request.package, request.options)
        .then((result): AnalyzeOutcome => ({ ok: true, result }))
        .catch((error: unknown): AnalyzeOutcome => ({ ok: false, failure: toFailure(error, request.options.dir) }))
        .then((outcome) => {
            process.send?.(outcome, () => process.exit(0));
        });
});
