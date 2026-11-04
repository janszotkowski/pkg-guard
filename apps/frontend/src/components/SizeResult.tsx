import type { AnalysisResult } from '@pkg-guard/core';
import { FigureBand } from '@components/FigureBand';
import { formatSize, formatSizeText } from '@lib/format';

type SizeResultProps = { result: AnalysisResult };

/** The number people came for first (what goes over the wire), then the rest in one ruled band, then how it was measured. */
export const SizeResult = (props: SizeResultProps) => {
    const gzip = formatSize(props.result.sizes.gzip);
    const { bundler, install, peerDependencies, sizes } = props.result;

    return (
        <div className={'flex flex-col gap-8'}>
            <div className={'flex flex-col gap-1'}>
                <p className={'text-overline text-muted-foreground uppercase'}>Minified + gzip</p>
                <p className={'text-score tabular-nums'}>
                    {gzip.value}
                    <span className={'ml-3 text-title-1 text-muted-foreground'}>{gzip.unit}</span>
                </p>
            </div>
            <FigureBand
                items={[
                    { label: 'Minified', value: formatSizeText(sizes.minified), hint: 'before compression' },
                    { label: 'Brotli', value: formatSizeText(sizes.brotli), hint: 'at the highest quality' },
                    { label: 'Install size', value: formatSizeText(install.bytes), hint: 'on disk, with dependencies' },
                    { label: 'Packages', value: String(install.packages), hint: install.packages === 1 ? 'no dependencies' : 'with its dependencies' },
                ]}
            />
            <p className={'text-callout text-muted-foreground'}>
                Measured with {bundler.name} {bundler.version}.{' '}
                {peerDependencies.length > 0 ? `Peer dependencies are not included: ${peerDependencies.join(', ')}.` : 'The package has no peer dependencies.'} Another bundler can give a different
                number.
            </p>
        </div>
    );
};
