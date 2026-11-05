export type FormattedSize = { value: string; unit: 'B' | 'kB' | 'MB' };

/** Decimal units, as bundlers and browsers report them. */
export const formatSize = (bytes: number): FormattedSize => {
    if (bytes < 1000) return { value: String(bytes), unit: 'B' };
    if (bytes < 1_000_000) return { value: (bytes / 1000).toFixed(1), unit: 'kB' };
    return { value: (bytes / 1_000_000).toFixed(2), unit: 'MB' };
};

const COUNT = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/** A large count at a glance: 89.7M. */
export const formatCount = (count: number): string => COUNT.format(count);

export const formatSizeText = (bytes: number): string => {
    const size = formatSize(bytes);
    return `${size.value} ${size.unit}`;
};

export const CONNECTIONS = [
    { name: 'slow 3G', label: '400 kbit/s', bitsPerSecond: 400_000 },
    { name: '4G', label: '9 Mbit/s', bitsPerSecond: 9_000_000 },
] as const;

const formatDuration = (ms: number): string => {
    if (ms < 1) return '< 1 ms';
    if (ms < 999.5) return `${Math.round(ms)} ms`;
    if (ms < 59_950) return `${(ms / 1000).toFixed(1)} s`;
    const seconds = Math.round(ms / 1000);
    return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
};

/** How long the bytes take at a speed: the transfer alone, without latency, parsing or running. */
export const formatDownloadTime = (bytes: number, bitsPerSecond: number): string => formatDuration(((bytes * 8) / bitsPerSecond) * 1000);

export const formatDownloadTimes = (bytes: number): string => CONNECTIONS.map(({ name, label, bitsPerSecond }) => `${formatDownloadTime(bytes, bitsPerSecond)} on ${name} (${label})`).join(', ');
