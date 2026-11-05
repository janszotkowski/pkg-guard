import { PRERENDERED_PAGES } from '../src/lib/documents/pages.ts';

/**
 * TanStack Start prerender entries: the pages built once at build time, from the list the sitemap reads too. Add a
 * public page in `src/lib/documents/pages.ts`; nothing else needs to change.
 */
export const getTanstackStartPages = (): { path: string }[] => PRERENDERED_PAGES.map((path) => ({ path }));
