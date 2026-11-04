import { useId, type CSSProperties } from 'react';
import { boxFaces, floorRect, onLeft, onTop, path3d, project, type Box } from '@lib/iso';
import { IsoBox, IsoDefs, Sparks } from './IsoParts';

const FLOOR = -16;
const PEDESTAL: Box = { x: -30, y: -30, z: FLOOR, w: 160, d: 160, h: 16 };
const PACKAGE: Box = { x: 0, y: 0, z: 0, w: 100, d: 100, h: 70 };
const CENTER = 50;

/** What a package comes to, one size above the other, each smaller than the last. */
const LAYERS = [
    { label: 'minified', size: 100, z: 98 },
    { label: 'gzip', size: 72, z: 124 },
    { label: 'brotli', size: 54, z: 148 },
] as const;
const LAYER_HEIGHT = 9;

const CHIP_SIZE = 36;
const CHIP_HEIGHT = 9;
/** Where it comes from and what reads it, wired to the pedestal. */
const CHIPS = [
    {
        label: 'npm',
        box: { x: 172, y: 14, z: FLOOR, w: CHIP_SIZE, d: CHIP_SIZE, h: CHIP_HEIGHT },
        wire: [
            [172, 32, FLOOR],
            [150, 32, FLOOR],
            [150, 50, FLOOR],
            [130, 50, FLOOR],
        ],
    },
    {
        label: 'bundle',
        box: { x: 14, y: 172, z: FLOOR, w: CHIP_SIZE, d: CHIP_SIZE, h: CHIP_HEIGHT },
        wire: [
            [32, 172, FLOOR],
            [32, 150, FLOOR],
            [50, 150, FLOOR],
            [50, 130, FLOOR],
        ],
    },
] as const;

const layerBox = (layer: (typeof LAYERS)[number]): Box => ({ x: CENTER - layer.size / 2, y: CENTER - layer.size / 2, z: layer.z, w: layer.size, d: layer.size, h: LAYER_HEIGHT });

type IsoPackageProps = { className?: string };

/** The home page: a package on a pedestal, the sizes it comes to floating above it, and data running along the wires. */
export const IsoPackage = (props: IsoPackageProps) => {
    const id = useId().replace(/:/g, '');
    const [poolX, poolY] = project(CENTER, CENTER, 0);
    return (
        <svg
            aria-hidden={'true'}
            className={`iso ${props.className ?? ''}`}
            viewBox={'-230 -205 460 375'}
        >
            <IsoDefs id={id} />
            <ellipse
                cx={poolX}
                cy={poolY}
                rx={230}
                ry={125}
                fill={`url(#${id}-pool)`}
            />
            <IsoBox box={PEDESTAL} />
            {CHIPS.map((chip, index) => {
                const wire = path3d(chip.wire);
                return (
                    <g key={chip.label}>
                        <path
                            className={'wire'}
                            d={wire}
                        />
                        <path
                            className={'pulse'}
                            d={wire}
                            style={{ '--i': index * 3 } as CSSProperties}
                            filter={`url(#${id}-soft)`}
                        />
                        <IsoBox box={chip.box} />
                        <g transform={onTop(chip.box.x, chip.box.y, chip.box.z + chip.box.h)}>
                            <text
                                className={'label'}
                                x={4}
                                y={21}
                                fontSize={6.5}
                            >
                                {chip.label}
                            </text>
                        </g>
                    </g>
                );
            })}
            <polygon
                className={'halo'}
                points={floorRect(10, 10, 0, 80, 80)}
                filter={`url(#${id}-bloom)`}
            />
            <IsoBox box={PACKAGE} />
            {/* The tape over its top and down its front, and a shipping label. */}
            <polygon
                className={'face recess'}
                points={floorRect(CENTER - 8, 0, PACKAGE.h, 16, PACKAGE.d)}
            />
            <g transform={onLeft(PACKAGE.x, PACKAGE.y + PACKAGE.d, PACKAGE.h)}>
                <rect
                    className={'face recess'}
                    x={CENTER - 8}
                    width={16}
                    height={18}
                />
                <text
                    className={'label'}
                    x={10}
                    y={58}
                    fontSize={8}
                >
                    package
                </text>
                <path
                    className={'detail'}
                    d={'M10 48h34M10 42h22'}
                />
                <circle
                    className={'led on'}
                    cx={88}
                    cy={58}
                    r={2.6}
                />
            </g>
            <path
                className={'detail'}
                d={path3d([
                    [CENTER, CENTER, PACKAGE.h],
                    [CENTER, CENTER, LAYERS[0].z],
                ])}
            />
            {LAYERS.map((layer, index) => {
                const box = layerBox(layer);
                const faces = boxFaces(box);
                return (
                    <g
                        key={layer.label}
                        className={'float'}
                        style={{ '--i': index } as CSSProperties}
                    >
                        <g className={index === LAYERS.length - 1 ? 'hot' : undefined}>
                            <IsoBox box={box} />
                        </g>
                        <polygon
                            className={'halo'}
                            points={faces.top}
                            opacity={0.08}
                        />
                        <g transform={onLeft(box.x, box.y + box.d, box.z + box.h)}>
                            <text
                                className={'label'}
                                x={4}
                                y={6.8}
                                fontSize={5.5}
                            >
                                {layer.label}
                            </text>
                        </g>
                    </g>
                );
            })}
            <Sparks
                at={[
                    [-150, -120],
                    [160, -90],
                    [105, -175],
                    [-195, 10],
                ]}
            />
        </svg>
    );
};
