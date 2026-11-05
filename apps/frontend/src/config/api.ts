import { visitorIp } from '@lib/visitor';

const configuredApiUrl: unknown = import.meta.env.VITE_API_URL;

/** The backend's public address, which the browser calls, without a trailing slash. Baked in at build time; the policy and the documents name it. */
export const API_URL: string = (typeof configuredApiUrl === 'string' && configuredApiUrl !== '' ? configuredApiUrl : 'http://127.0.0.1:4100').replace(/\/+$/, '');

/** A server-only setting, read at request time: never bundled for the browser, blank the same as unset. */
const serverSetting = (name: string): string | undefined => {
    const value = import.meta.env.SSR ? process.env[name]?.trim() : undefined;
    return value === undefined || value === '' ? undefined : value;
};

/**
 * Two callers, one backend: the browser calls the public address, while the server rendering may use an internal one
 * that never leaves the network. `API_INTERNAL_URL` has no `VITE_` prefix, so it is never in the browser's bundle.
 */
export const apiBaseUrl = (): string => serverSetting('API_INTERNAL_URL')?.replace(/\/+$/, '') ?? API_URL;

/**
 * The token the frontend's server proves itself with (`x-internal-token`), so its rendering, which asks on behalf of
 * every visitor at once, is not rate limited as one caller, and the visitor it renders for (`x-visitor-ip`), whom the
 * API limits instead. Empty in the browser.
 */
export const internalApiHeaders = (): Record<string, string> => {
    const token = serverSetting('INTERNAL_API_TOKEN');
    if (token === undefined) return {};
    const visitor = visitorIp();
    return { 'x-internal-token': token, ...(visitor === undefined ? {} : { 'x-visitor-ip': visitor }) };
};
