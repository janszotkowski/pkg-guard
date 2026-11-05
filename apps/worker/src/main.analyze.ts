import { analyze } from '@modules/analysis/analyze.ts';
import { toFailure } from '@modules/analysis/failure.ts';
import type { AnalyzeMessage, AnalyzeRequest } from '@modules/analysis/protocol.ts';

const send = (message: AnalyzeMessage): Promise<void> =>
    new Promise((resolve) => {
        process.send?.(message, () => resolve());
    });

/** The process of one analysis (`runner.ts`): takes one request, answers as it goes and ends. */
process.once('message', (message) => {
    const request = message as AnalyzeRequest;
    void (async () => {
        try {
            const analysis = await analyze(request.package, request.options);
            await send({ kind: 'result', result: analysis.result });
            try {
                await send({ kind: 'exports', exports: await analysis.measureParts() });
            } catch {
                await send({ kind: 'exports-failure' });
            }
        } catch (error) {
            await send({ kind: 'failure', failure: toFailure(error, [request.options.dir, request.options.storeDir]) });
        }
        process.exit(0);
    })();
});
