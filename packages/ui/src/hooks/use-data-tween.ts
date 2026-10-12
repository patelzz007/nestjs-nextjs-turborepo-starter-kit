"use client";

import * as React from "react";

export interface DataTween {
	/** Whether the marks should tween on this render: on entrance and after a data change, until the tween ends. */
	readonly isTweening: boolean;
	/** Call when the tween has finished (a chart's `onAnimationEnd`); later renders draw in place. */
	readonly endTween: () => void;
}

/**
 * Animates a chart's marks only when its data changes — never when only its
 * size does. Charting libraries tween every time their computed marks move,
 * and a resize moves them all: a window resize or the sidebar collapsing
 * would replay a sweep across the chart. This is on from the first render
 * (the entrance), off once the tween ends, and back on for the next `data`
 * (an array or object, compared by identity — pass a memoized one).
 */
export function useDataTween(data: object): DataTween {
	const [isTweening, setIsTweening] = React.useState(true);
	const [tweenedData, setTweenedData] = React.useState(data);
	if (tweenedData !== data) {
		setTweenedData(data);
		setIsTweening(true);
	}
	const endTween = React.useCallback((): void => {
		setIsTweening(false);
	}, []);
	return { isTweening, endTween };
}
