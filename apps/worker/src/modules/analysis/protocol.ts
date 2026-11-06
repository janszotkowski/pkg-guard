import type { AnalysisFailure, AnalysisResult, ExportDetails, PackageRef } from '@weighme/core';
import type { AnalyzeOptions } from './analyze.ts';

/** What the worker sends to the process of one analysis. */
export type AnalyzeRequest = { package: PackageRef; options: AnalyzeOptions };

/**
 * What that process sends back: the main result or its failure first, then, after a result, the part-by-part numbers
 * or the news that there are none.
 */
export type AnalyzeMessage = { kind: 'result'; result: AnalysisResult } | { kind: 'failure'; failure: AnalysisFailure } | { kind: 'exports'; exports: ExportDetails } | { kind: 'exports-failure' };
