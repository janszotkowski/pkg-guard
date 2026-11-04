import { pino, type Logger } from 'pino';
import type { Config } from '@config/env.ts';

export type { Logger };

/** Structured JSON to stdout, nothing else. Secrets are redacted by path. */
export const createLogger = (config: Pick<Config, 'LOG_LEVEL'>): Logger =>
    pino({
        level: config.LOG_LEVEL,
        base: { service: 'api' },
        messageKey: 'msg',
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: { level: (label) => ({ level: label }) },
        redact: { paths: ['req.headers.authorization', 'req.headers.cookie'], censor: '[redacted]' },
    });
