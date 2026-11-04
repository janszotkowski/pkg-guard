import type { AnalysisFailure, AnalysisResult, PackageRef } from '@pkg-guard/core';
import type { AnalyzeOptions } from './analyze.ts';

/** What the worker sends to the process of one analysis. */
export type AnalyzeRequest = { package: PackageRef; options: AnalyzeOptions };

/** What that process answers. */
export type AnalyzeOutcome = { ok: true; result: AnalysisResult } | { ok: false; failure: AnalysisFailure };
