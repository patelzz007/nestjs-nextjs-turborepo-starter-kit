import * as React from "react";
import { Label } from "@workspace/ui/components/label";
import { Slider } from "@workspace/ui/components/slider";

export function SliderDont2Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs flex-col gap-2">
			<Label id="slider-dont-2-label">Exact age</Label>
			<Slider defaultValue={47} min={0} max={120} step={1} aria-labelledby="slider-dont-2-label" />
		</div>
	);
}
