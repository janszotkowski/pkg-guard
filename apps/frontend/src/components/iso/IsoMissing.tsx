import { useId } from 'react';
import { floorRect, onLeft, project } from '@lib/iso';
import { IsoBox, IsoDefs, IsoGhost, Sparks } from './IsoParts';

const PEDESTAL = { x: -20, y: -20, z: -20, w: 140, d: 140, h: 20 } as const;
const CUBE = { x: 10, y: 10, z: 16, w: 80, d: 80, h: 80 } as const;

type IsoMissingProps = { label: string; className?: string };

/** A page or a record that is not there: a pedestal with the outline of what should stand on it. */
export const IsoMissing = (props: IsoMissingProps) => {
    const id = useId().replace(/:/g, '');
    const [poolX, poolY] = project(50, 50, 0);
    return (
        <svg
            aria-hidden={'true'}
            className={`iso ${props.className ?? ''}`}
            viewBox={'-140 -125 280 280'}
        >
            <IsoDefs id={id} />
            <ellipse
                cx={poolX}
                cy={poolY}
                rx={140}
                ry={75}
                fill={`url(#${id}-pool)`}
            />
            <IsoBox box={PEDESTAL} />
            <polygon
                className={'halo'}
                points={floorRect(20, 20, 0, 60, 60)}
                filter={`url(#${id}-bloom)`}
            />
            <IsoGhost
                id={id}
                box={CUBE}
            />
            <g transform={onLeft(PEDESTAL.x, PEDESTAL.y + PEDESTAL.d, 0)}>
                <text
                    className={'label'}
                    x={12}
                    y={13}
                    fontSize={8}
                >
                    {props.label}
                </text>
            </g>
            <Sparks
                at={[
                    [-100, -90],
                    [105, -50],
                    [45, -115],
                    [-125, 20],
                ]}
            />
        </svg>
    );
};
