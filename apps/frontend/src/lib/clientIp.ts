import { isIP } from 'node:net';

/**
 * Headers that carry a chain of addresses, the first of them written by whoever sent the request: anyone can put any
 * address there, so they never name the visitor. `CLIENT_IP_HEADER` must be a header the proxy in front overwrites
 * with one address (`cf-connecting-ip`, `x-real-ip`).
 */
const CHAIN_HEADERS = new Set(['x-forwarded-for', 'forwarded']);

/** The configured `CLIENT_IP_HEADER`, lower case; undefined when unset, and for a chain header, which is refused. */
export const clientIpHeader = (configured: string | undefined): string | undefined => {
    const header = configured?.trim().toLowerCase();
    if (header === undefined || header === '') return undefined;
    if (CHAIN_HEADERS.has(header)) {
        console.warn(`CLIENT_IP_HEADER=${header} is ignored: it carries addresses the client wrote. Use a single-value header the proxy sets (cf-connecting-ip, x-real-ip).`);
        return undefined;
    }
    return header;
};

/** One address as a proxy writes it: `203.0.113.7`, `2001:db8::1`, `[2001:db8::1]` or with a port (`203.0.113.7:443`, `[2001:db8::1]:443`); undefined for anything else. */
export const parseIp = (value: string | null | undefined): string | undefined => {
    const text = value?.trim() ?? '';
    if (text === '') return undefined;
    const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(text);
    if (bracketed !== null) return isIP(bracketed[1] ?? '') === 6 ? bracketed[1] : undefined;
    if (isIP(text) !== 0) return text;
    const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(text);
    return withPort !== null && isIP(withPort[1] ?? '') === 4 ? withPort[1] : undefined;
};

let warnedOfNoAddress = false;

/**
 * The visitor's address: the one the proxy in front wrote into `CLIENT_IP_HEADER` (set it only behind a proxy that
 * overwrites the header), else the address of the connection, which the Node server puts on the request as `ip`. A
 * header that is not one valid address (a list, a name, garbage) is not believed: the connection's address is used.
 *
 * No address at all means a misconfigured deployment (an adapter that does not set `ip`, a proxy whose header is not
 * named): the API then cannot count renders per visitor, so production says so once in the log rather than silently.
 */
export const requestIp = (request: Request, header: string | undefined, production = import.meta.env.PROD): string | undefined => {
    const forwarded = header === undefined ? undefined : parseIp(request.headers.get(header));
    if (forwarded !== undefined) return forwarded;
    const ip = (request as Request & { ip?: unknown }).ip;
    if (typeof ip === 'string' && ip !== '') return ip;
    if (production && !warnedOfNoAddress) {
        warnedOfNoAddress = true;
        console.warn(
            'No visitor address on a request: the server sees no connection address and CLIENT_IP_HEADER names no header the proxy sets. Renders are not counted per visitor until it is set.',
        );
    }
    return undefined;
};
