import { isIP } from 'node:net';
import { Address6 } from 'ip-address';

/** A header's value when it is one IPv4 or IPv6 address, nothing else: a list or any other text is not taken at its word. */
export const addressIn = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim();
    return trimmed !== undefined && isIP(trimmed) !== 0 ? trimmed : undefined;
};

/**
 * Who a request counts against: the address the trusted proxy wrote into `CLIENT_IP_HEADER` when it is one, else the
 * connection's. An IPv6 caller is counted by its /64, the block one subscriber usually holds, so it cannot rotate
 * addresses around the limit.
 */
export const clientKey = (header: string | undefined, socketAddress: string | undefined): string => {
    const address = (addressIn(header) ?? socketAddress ?? 'unknown').replace(/^::ffff:/i, '');
    if (!address.includes(':')) return address;
    // Any spelling of the same /64 (`::` or not, leading zeros) gives the same key; a zone (`%eth0`) is not part of it.
    try {
        return `${new Address6(`${address.split('%')[0] ?? ''}/64`).startAddress().correctForm()}/64`;
    } catch {
        return address;
    }
};
