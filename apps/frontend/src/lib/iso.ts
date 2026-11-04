/**
 * Isometric projection for the illustrations (classic 30°): x runs down-right, y down-left, z up. Shapes are built in
 * 3D units and projected once to SVG points.
 */
const C = Math.cos(Math.PI / 6);
const S = 0.5;

export type Point = readonly [number, number];

export const project = (x: number, y: number, z: number): Point => [(x - y) * C, (x + y) * S - z];

export const points = (corners: readonly Point[]): string => corners.map(([px, py]) => `${px.toFixed(2)},${py.toFixed(2)}`).join(' ');

export type Box = { x: number; y: number; z: number; w: number; d: number; h: number };

/** The three visible faces of a box: its top, its front-left side (y = y + d) and its front-right side (x = x + w). */
export const boxFaces = ({ x, y, z, w, d, h }: Box) => ({
    top: points([project(x, y, z + h), project(x + w, y, z + h), project(x + w, y + d, z + h), project(x, y + d, z + h)]),
    left: points([project(x, y + d, z), project(x + w, y + d, z), project(x + w, y + d, z + h), project(x, y + d, z + h)]),
    right: points([project(x + w, y, z), project(x + w, y + d, z), project(x + w, y + d, z + h), project(x + w, y, z + h)]),
});

/** A flat rectangle on the plane z (a shadow, a halo, a pad). */
export const floorRect = (x: number, y: number, z: number, w: number, d: number): string => points([project(x, y, z), project(x + w, y, z), project(x + w, y + d, z), project(x, y + d, z)]);

/** A path through 3D points. */
export const path3d = (corners: readonly (readonly [number, number, number])[]): string =>
    corners
        .map(
            ([x, y, z], index) =>
                `${index === 0 ? 'M' : 'L'}${project(x, y, z)
                    .map((value) => value.toFixed(2))
                    .join(' ')}`,
        )
        .join(' ');

const matrix = (a: number, b: number, c: number, d: number, origin: Point): string => `matrix(${a} ${b} ${c} ${d} ${origin[0].toFixed(2)} ${origin[1].toFixed(2)})`;

/** Draw flat (u right, v down) and land on the top face of a box, u along +x and v along +y, from its back corner. */
export const onTop = (x: number, y: number, z: number): string => matrix(C, S, -C, S, project(x, y, z));

/** Land on a front-left side (the plane y = const): u along +x, v down, from the top-left corner. */
export const onLeft = (x: number, y: number, z: number): string => matrix(C, S, 0, 1, project(x, y, z));
