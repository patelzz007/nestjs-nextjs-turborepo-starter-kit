"use client";

// A recharts `Bar` shape that extrudes each bar into a 3D block: a back face
// offset up and to the right, a right side, a top and the front face. Shared
// by the "3D Gradient Bars" and "Isometric Bars" examples, which differ only
// in how each face is painted.

import type * as React from "react";
import type { BarShapeProps } from "recharts";

/** The block's depth as a share of the bar's width… */
const DEPTH_TO_WIDTH_RATIO = 0.3;
/** …capped so wide bars do not turn into slabs (px). */
const MAX_DEPTH_PX = 15;
/** How far the side and top faces sit inside the block's edges, hiding seams (px). */
const FACE_INSET_PX = 3;
/** Corner radius of the front and back faces (px). */
const FACE_CORNER_RADIUS_PX = 3;

/** How one face is painted. */
export interface IsometricBarFace {
	readonly fill: string;
	readonly opacity?: number;
}

export interface IsometricBarFaces {
	readonly back: IsometricBarFace;
	readonly side: IsometricBarFace;
	readonly top: IsometricBarFace;
	readonly front: IsometricBarFace;
}

type Point = readonly [x: number, y: number];

/** An SVG `points` attribute: "x1,y1 x2,y2 …". */
function svgPoints(points: readonly Point[]): string {
	return points.map(([x, y]: Point): string => `${String(x)},${String(y)}`).join(" ");
}

/** Builds the bar shape for `<Bar shape={…} />`, painting each face as given. */
export function createIsometricBarShape(faces: IsometricBarFaces): (props: BarShapeProps) => React.JSX.Element {
	return function renderIsometricBar({ x, y, width, height }: BarShapeProps): React.JSX.Element {
		const depth = Math.min(width * DEPTH_TO_WIDTH_RATIO, MAX_DEPTH_PX);
		const right = x + width;
		const bottom = y + height;
		const sidePoints = svgPoints([
			[right + FACE_INSET_PX, y - FACE_INSET_PX],
			[right + depth - FACE_INSET_PX, y - depth + FACE_INSET_PX],
			[right + depth - FACE_INSET_PX, bottom - depth - FACE_INSET_PX],
			[right + FACE_INSET_PX, bottom - FACE_INSET_PX],
		]);
		const topPoints = svgPoints([
			[x + FACE_INSET_PX, y - FACE_INSET_PX],
			[right - FACE_INSET_PX, y - FACE_INSET_PX],
			[right + depth - FACE_INSET_PX, y - depth + FACE_INSET_PX],
			[x + depth + FACE_INSET_PX, y - depth + FACE_INSET_PX],
		]);
		return (
			<g>
				<rect x={x + depth} y={y - depth} width={width} height={height} fill={faces.back.fill} opacity={faces.back.opacity} rx={FACE_CORNER_RADIUS_PX} />
				<polygon points={sidePoints} fill={faces.side.fill} opacity={faces.side.opacity} />
				<polygon points={topPoints} fill={faces.top.fill} opacity={faces.top.opacity} />
				<rect x={x} y={y} width={width} height={height} fill={faces.front.fill} opacity={faces.front.opacity} rx={FACE_CORNER_RADIUS_PX} />
			</g>
		);
	};
}
