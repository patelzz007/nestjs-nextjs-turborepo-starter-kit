"use client";

import { isArrayValue } from "@workspace/shared";
import { Label } from "@workspace/ui/components/label";
import { Slider } from "@workspace/ui/components/slider";
import * as React from "react";

/** The range starts at 30%–70% of the unit interval. */
const INITIAL_RANGE: readonly number[] = [0.3, 0.7];
const RANGE_MIN = 0;
const RANGE_MAX = 1;
const RANGE_STEP = 0.1;
/** One decimal place, matching the 0.1 step. */
const RANGE_FRACTION_DIGITS = 1;

export function Slider5Example(): React.JSX.Element {
	const [value, setValue] = React.useState<readonly number[]>(INITIAL_RANGE);
	const [start = RANGE_MIN, end = RANGE_MAX] = value;

	const handleValueChange = React.useCallback((next: number | readonly number[]): void => {
		setValue(isArrayValue(next) ? next : [next]);
	}, []);

	return (
		<div className="mx-auto grid w-full max-w-sm gap-4">
			<div className="flex items-center justify-between gap-2">
				<Label htmlFor="slider-controlled" className="text-sm font-medium">
					Controlled Range
				</Label>
				<span className="text-xs font-semibold text-secondary-foreground">
					{start.toFixed(RANGE_FRACTION_DIGITS)} – {end.toFixed(RANGE_FRACTION_DIGITS)}
				</span>
			</div>
			<Slider id="slider-controlled" value={value} onValueChange={handleValueChange} min={RANGE_MIN} max={RANGE_MAX} step={RANGE_STEP} />
		</div>
	);
}
