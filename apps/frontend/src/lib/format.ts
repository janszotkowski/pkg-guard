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
