"use client";

import { isArrayValue } from "@workspace/shared";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Slider } from "@workspace/ui/components/slider";
import * as React from "react";

const OPACITY_MIN = 0;
const OPACITY_MAX = 100;
const OPACITY_INITIAL = 50;
const OPACITY_STEP = 1;

export function Slider7Example(): React.JSX.Element {
	const [value, setValue] = React.useState(OPACITY_INITIAL);

	const handleInputChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		const next = Number(event.target.value);
		if (next >= OPACITY_MIN && next <= OPACITY_MAX) setValue(next);
	}, []);

	const handleSliderChange = React.useCallback((next: number | readonly number[]): void => {
		const [first = OPACITY_INITIAL] = isArrayValue(next) ? next : [next];
		setValue(first);
	}, []);

	return (
		<div className="mx-auto grid w-full max-w-sm gap-4">
			<div className="flex items-center justify-between">
				<Label htmlFor="slider-input" className="text-sm font-medium">
					Opacity
				</Label>
				<div className="flex items-center gap-1.5">
					<Input
						id="slider-input"
						type="number"
						value={value}
						onChange={handleInputChange}
						min={OPACITY_MIN}
						max={OPACITY_MAX}
						className="h-8 w-16 text-center text-sm tabular-nums"
					/>
					<span className="text-xs text-muted-foreground">%</span>
				</div>
			</div>
			<Slider aria-label="Opacity" value={value} onValueChange={handleSliderChange} min={OPACITY_MIN} max={OPACITY_MAX} step={OPACITY_STEP} />
		</div>
	);
}
