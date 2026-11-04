import type { CSSProperties } from 'react';
import { boxFaces, type Box } from '@lib/iso';

type IsoDefsProps = { id: string };

/** The filters the illustrations share: a soft glow for lit lines and a wide bloom for light on a surface. */
export const IsoDefs = (props: IsoDefsProps) => (
    <defs>
        <filter
            id={`${props.id}-soft`}
            filterUnits={'userSpaceOnUse'}
            x={'-2000'}
            y={'-2000'}
            width={'6000'}
            height={'6000'}
        >
            <feGaussianBlur
                stdDeviation={'2'}
                result={'b'}
            />
            <feMerge>
                <feMergeNode in={'b'} />
                <feMergeNode in={'SourceGraphic'} />
            </feMerge>
        </filter>
        <filter
            id={`${props.id}-bloom`}
            filterUnits={'userSpaceOnUse'}
            x={'-2000'}
            y={'-2000'}
            width={'6000'}
            height={'6000'}
        >
            <feGaussianBlur stdDeviation={'14'} />
        </filter>
        <radialGradient id={`${props.id}-pool`}>
            <stop
                offset={'0%'}
                stopColor={'var(--iso-glow)'}
                stopOpacity={'0.22'}
            />
            <stop
                offset={'60%'}
                stopColor={'var(--iso-glow)'}
                stopOpacity={'0.05'}
            />
            <stop
                offset={'100%'}
                stopColor={'var(--iso-glow)'}
                stopOpacity={'0'}
            />
        </radialGradient>
    </defs>
);

type IsoBoxProps = { box: Box; className?: string };

/** A solid box: its two sides and its top. */
export const IsoBox = (props: IsoBoxProps) => {
    const faces = boxFaces(props.box);
    return (
        <g className={props.className}>
            <polygon
                className={'face side'}
                points={faces.left}
            />
            <polygon
                className={'face side'}
                points={faces.right}
            />
            <polygon
                className={'face top'}
                points={faces.top}
            />
        </g>
    );
};

type IsoGhostProps = { box: Box; id: string };

/** A box that is not there: its outline, dashed and lit. */
export const IsoGhost = (props: IsoGhostProps) => {
    const faces = boxFaces(props.box);
    return (
        <g
            className={'ghost'}
            filter={`url(#${props.id}-soft)`}
        >
            <polygon points={faces.left} />
            <polygon points={faces.right} />
            <polygon points={faces.top} />
        </g>
    );
};

type SparksProps = { at: readonly (readonly [number, number])[] };

/** Small squares drifting above an illustration, lit in the accent. */
export const Sparks = (props: SparksProps) => (
    <g>
        {props.at.map(([x, y], index) => (
            <rect
                key={`${x}:${y}`}
                className={'spark'}
                style={{ '--i': index } as CSSProperties}
                x={x}
                y={y}
                width={index % 2 === 0 ? 5 : 3.5}
                height={index % 2 === 0 ? 5 : 3.5}
                transform={`rotate(45 ${x} ${y})`}
            />
        ))}
    </g>
);
