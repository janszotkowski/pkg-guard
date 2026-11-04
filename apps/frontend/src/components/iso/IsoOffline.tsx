import { useId } from 'react';
import type { Box } from '@lib/iso';
import { onLeft, project } from '@lib/iso';
import { IsoBox, IsoDefs, IsoGhost, Sparks } from './IsoParts';

const BASE = { x: -10, y: -10, z: -12, w: 245, d: 165, h: 12 } as const;
const UNIT = { x: 0, y: 0, w: 100, d: 80, h: 20 } as const;
const RACK: readonly Box[] = [
    { ...UNIT, z: 0 },
    { ...UNIT, z: 24 },
];
/** Where the failed unit sat, now an outline. */
const SLOT: Box = { ...UNIT, z: 48 };
/** The failed unit, taken out and set down beside the rack. */
const FAILED: Box = { ...UNIT, x: 125, y: 70, z: 0 };

type FrontProps = { box: Box; failed: boolean };

/** Its front: two lights and a few vents, drawn flat and laid onto the front side. */
const Front = (props: FrontProps) => (
    <g transform={onLeft(props.box.x, props.box.y + props.box.d, props.box.z + props.box.h)}>
        <circle
            className={props.failed ? 'led alert' : 'led on'}
            cx={10}
            cy={10}
            r={2.6}
        />
        <circle
            className={'led'}
            cx={19}
            cy={10}
            r={2.6}
        />
        {[44, 54, 64, 74, 84].map((u) => (
            <path
                key={u}
                className={'detail'}
                d={`M${u} 5v10`}
            />
        ))}
    </g>
);

type IsoOfflineProps = { className?: string };

/** The service is down: a rack with an empty slot, and the failed server beside it, blinking. */
export const IsoOffline = (props: IsoOfflineProps) => {
    const id = useId().replace(/:/g, '');
    const [poolX, poolY] = project(110, 75, 0);
    return (
        <svg
            aria-hidden={'true'}
            className={`iso ${props.className ?? ''}`}
            viewBox={'-150 -100 370 300'}
        >
            <IsoDefs id={id} />
            <ellipse
                cx={poolX}
                cy={poolY}
                rx={190}
                ry={100}
                fill={`url(#${id}-pool)`}
            />
            <IsoBox box={BASE} />
            {RACK.map((box) => (
                <g key={box.z}>
                    <IsoBox box={box} />
                    <Front
                        box={box}
                        failed={false}
                    />
                </g>
            ))}
            <IsoGhost
                id={id}
                box={SLOT}
            />
            <IsoBox box={FAILED} />
            <Front
                box={FAILED}
                failed
            />
            <Sparks
                at={[
                    [-110, -60],
                    [150, -20],
                    [60, -90],
                ]}
            />
        </svg>
    );
};
