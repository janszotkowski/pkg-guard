import type { NitroConfig } from 'nitro/types';

type OnLog = NonNullable<NonNullable<NitroConfig['rolldownConfig']>['onLog']>;

/**
 * Log handling for the production bundle.
 *
 * Libraries such as Base UI and TanStack Router start their files with the `'use client'`
 * directive, which only means something to a React Server Components bundler. This app
 * renders on the server with TanStack Start and Nitro and has no server-component boundary,
 * so for it the directive is inert, and the bundler's warning that it "may not be preserved"
 * is noise (dozens of lines on every build) that hides warnings that matter.
 *
 * Only that exact warning is dropped, and only for code under node_modules. Every other log,
 * including a `'use client'` directive in our own source, still reaches the console.
 */
export const dropUseClientDirectiveWarning: OnLog = (level, log, defaultHandler) => {
    const isUseClientDirective = log.code === 'MODULE_LEVEL_DIRECTIVE' && log.message.includes('"use client"');
    const isDependency = log.id?.includes('/node_modules/') ?? false;
    if (isUseClientDirective && isDependency) return;
    defaultHandler(level, log);
};
