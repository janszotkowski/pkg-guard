/**
 * Who the page being rendered is for, so the API counts its requests against that visitor (`x-visitor-ip`) and not
 * against the frontend as a whole. The server entry keeps it in an `AsyncLocalStorage` it puts on `globalThis`: this
 * module is read by code the browser bundles too, so it imports nothing of Node.
 */
type VisitorStore = { getStore: () => { ip: string | undefined } | undefined };

export const VISITOR_STORE_KEY = Symbol.for('pkg-guard.visitor');

/** The address of the visitor this server render is for; undefined in the browser and outside a request. */
export const visitorIp = (): string | undefined => (globalThis as { [VISITOR_STORE_KEY]?: VisitorStore })[VISITOR_STORE_KEY]?.getStore()?.ip;
