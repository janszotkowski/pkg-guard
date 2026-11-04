const configuredApiUrl: unknown = import.meta.env.VITE_API_URL;

/** The backend's address, without a trailing slash. Baked in at build time. */
export const API_URL: string = (typeof configuredApiUrl === 'string' && configuredApiUrl !== '' ? configuredApiUrl : 'http://127.0.0.1:4100').replace(/\/+$/, '');
