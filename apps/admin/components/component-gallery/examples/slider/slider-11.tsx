"use client";

import { isArrayValue } from "@workspace/shared";
import { Label } from "@workspace/ui/components/label";
import { Slider } from "@workspace/ui/components/slider";
import * as React from "react";

const VOLUME_MIN = 0;
const VOLUME_MAX = 100;
const VOLUME_INITIAL = 50;
const VOLUME_STEP = 1;
const PERCENT = 100;

export function Slider11Example(): React.JSX.Element {
	const [value, setValue] = React.useState(VOLUME_INITIAL);
	const percentage = ((value - VOLUME_MIN) / (VOLUME_MAX - VOLUME_MIN)) * PERCENT;

	const tooltipStyle = React.useMemo<React.CSSProperties>(() => ({ left: `${String(percentage)}%`, transform: "translateX(-50%)" }), [percentage]);

	const handleValueChange = React.useCallback((next: number | readonly number[]): void => {
		const [first = VOLUME_INITIAL] = isArrayValue(next) ? next : [next];
		setValue(first);
	}, []);

	return (
		<div className="mx-auto grid w-full max-w-sm gap-4">
			<Label className="text-sm font-medium">Volume</Label>
			<div className="relative pt-7">
				<div className="absolute top-0 rounded bg-foreground px-2 py-0.5 text-xs font-semibold text-background tabular-nums" style={tooltipStyle}>
					{value}%
					<div className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-foreground" />
				</div>
				<Slider aria-label="Volume" value={value} onValueChange={handleValueChange} min={VOLUME_MIN} max={VOLUME_MAX} step={VOLUME_STEP} />
			</div>
		</div>
	);
}
