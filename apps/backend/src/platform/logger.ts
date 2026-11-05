import { pino, type DestinationStream, type Logger } from 'pino';
import type { Config } from '@config/env.ts';

export type { Logger };

/**
 * Structured JSON to stdout, nothing else. `level` is written as a word so it filters well. No request header is logged on
 * purpose; the redaction is the safety net for the day something is logged whole (an error with the request in it), and
 * tests keep it in place. `destination` is for tests, which read the lines back.
 */
export const createLogger = (config: Pick<Config, 'LOG_LEVEL'>, destination?: DestinationStream): Logger =>
    pino(
        {
            level: config.LOG_LEVEL,
            base: { service: 'api' },
            messageKey: 'msg',
            timestamp: pino.stdTimeFunctions.isoTime,
            formatters: { level: (label) => ({ level: label }) },
            redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'headers.authorization', 'headers.cookie', '*.apiKey', '*.token', '*.password'], censor: '[redacted]' },
        },
        destination,
    );
