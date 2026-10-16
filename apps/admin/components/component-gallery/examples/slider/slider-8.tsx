"use client";

import { isArrayValue } from "@workspace/shared";
import { Label } from "@workspace/ui/components/label";
import { Slider } from "@workspace/ui/components/slider";
import * as React from "react";

/** Kelvin range of a typical tunable-white lamp. */
const TEMPERATURE_MIN_K = 2700;
const TEMPERATURE_MAX_K = 6500;
const TEMPERATURE_INITIAL_K = 4500;
const TEMPERATURE_STEP_K = 100;
/** Upper bound (inclusive, in kelvin) of each named band; above the last is "Cool". */
const WARM_MAX_K = 3000;
const NEUTRAL_MAX_K = 4500;
const DAYLIGHT_MAX_K = 5500;

/**
 * The swatch shows the physical light colour at each end of the range — content
 * being illustrated, not theme chrome, so it is not expressed in design tokens.
 */
const TEMPERATURE_SWATCH_STYLE: React.CSSProperties = {
	background: "linear-gradient(to right, #ff8a2b, #ffd4a3, #fff5e6, #e8f0ff, #a3c9ff)",
};

function temperatureLabel(kelvin: number): string {
	if (kelvin <= WARM_MAX_K) return "Warm";
	if (kelvin <= NEUTRAL_MAX_K) return "Neutral";
	if (kelvin <= DAYLIGHT_MAX_K) return "Daylight";
	return "Cool";
}

export function Slider8Example(): React.JSX.Element {
	const [temperature, setTemperature] = React.useState(TEMPERATURE_INITIAL_K);

	const handleValueChange = React.useCallback((next: number | readonly number[]): void => {
		const [first = TEMPERATURE_INITIAL_K] = isArrayValue(next) ? next : [next];
		setTemperature(first);
	}, []);

	return (
		<div className="mx-auto grid w-full max-w-sm gap-4">
			<div className="flex items-center justify-between">
				<Label className="text-sm font-medium">Color Temperature</Label>
				<span className="text-xs font-medium text-muted-foreground tabular-nums">
					{temperature}K &middot; {temperatureLabel(temperature)}
				</span>
			</div>
			<div className="h-2 rounded-full" style={TEMPERATURE_SWATCH_STYLE} />
			<Slider aria-label="Color temperature" value={temperature} onValueChange={handleValueChange} min={TEMPERATURE_MIN_K} max={TEMPERATURE_MAX_K} step={TEMPERATURE_STEP_K} />
		</div>
	);
}
