import type { ReactElement } from "react";

export interface ReadingRingProps {
	/** 0–100 */
	readonly percent: number;
	readonly size: number;
}

/** Ring radius and stroke in the 44-unit view box; the track and the filled arc use solid colours. */
const VIEW_BOX = 44;
const RADIUS = 18;
const STROKE = 4;

/** The progress ring: how much of the page the reader has scrolled past. Decorative (the text says it). */
export function ReadingRing({ percent, size }: ReadingRingProps): ReactElement {
	return (
		<svg width={size} height={size} viewBox={`0 0 ${String(VIEW_BOX)} ${String(VIEW_BOX)}`} aria-hidden="true" className="shrink-0 -rotate-90">
			<circle cx={VIEW_BOX / 2} cy={VIEW_BOX / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-border" />
			<circle
				cx={VIEW_BOX / 2}
				cy={VIEW_BOX / 2}
				r={RADIUS}
				fill="none"
				strokeWidth={STROKE}
				strokeLinecap="round"
				pathLength={100}
				strokeDasharray={`${String(percent)} 100`}
				className="stroke-(--docs-link) motion-safe:transition-[stroke-dasharray] motion-safe:duration-200"
			/>
		</svg>
	);
}
