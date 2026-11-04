import { useId } from 'react';
import { floorRect, path3d, project, type Box } from '@lib/iso';
import { IsoBox, IsoDefs, Sparks } from './IsoParts';

const FLOOR = -16;
const PEDESTAL: Box = { x: -30, y: -30, z: FLOOR, w: 160, d: 160, h: 16 };
const PACKAGE: Box = { x: 0, y: 0, z: 0, w: 100, d: 100, h: 70 };
const WIRE = path3d([
    [210, 50, FLOOR],
    [130, 50, FLOOR],
]);

type IsoAnalyzingProps = { className?: string };

/** A package being measured: it arrives along a wire while a plane of light reads it from bottom to top. */
export const IsoAnalyzing = (props: IsoAnalyzingProps) => {
    const id = useId().replace(/:/g, '');
    const [poolX, poolY] = project(50, 50, 0);
    return (
        <svg
            aria-hidden={'true'}
            className={`iso ${props.className ?? ''}`}
            viewBox={'-170 -115 370 290'}
        >
            <IsoDefs id={id} />
            <ellipse
                cx={poolX}
                cy={poolY}
                rx={170}
                ry={90}
                fill={`url(#${id}-pool)`}
            />
            <IsoBox box={PEDESTAL} />
            <path
                className={'wire'}
                d={WIRE}
            />
            <path
                className={'pulse'}
                d={WIRE}
                filter={`url(#${id}-soft)`}
            />
            <IsoBox box={PACKAGE} />
            <polygon
                className={'scan'}
                points={floorRect(-6, -6, 0, 112, 112)}
                filter={`url(#${id}-soft)`}
            />
            <Sparks
                at={[
                    [-120, -80],
                    [130, -40],
                    [60, -100],
                ]}
            />
        </svg>
    );
};
