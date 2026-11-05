import type { AnalysisResponse } from '../contract/analysis.ts';

/** Long lists are cut for an agent's context: the totals stay, and the package's page has the rest. */
export const AGENT_LIST_LIMIT = 25;

/** An analysis as agents get it, over MCP and WebMCP alike: long lists cut, and what to do next when it has to wait. */
export const analysisForAgent = (answer: AnalysisResponse) => {
    if (answer.status === 'queued' || answer.status === 'running') return { ...answer, next: 'Being measured: call again in a few seconds.' };
    if (answer.status !== 'done' || answer.exports.status !== 'done') return answer;
    const { details } = answer.exports;
    return { ...answer, exports: { status: answer.exports.status, details: { ...details, named: details.named.slice(0, AGENT_LIST_LIMIT), subpaths: details.subpaths.slice(0, AGENT_LIST_LIMIT) } } };
};
