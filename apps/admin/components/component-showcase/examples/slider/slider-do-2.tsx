import * as React from "react";
import { Label } from "@workspace/ui/components/label";
import { Slider } from "@workspace/ui/components/slider";

export function SliderDo2Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs flex-col gap-2">
			<Label id="slider-do-2-label">Storage (GB)</Label>
			<Slider defaultValue={50} min={0} max={200} step={5} aria-labelledby="slider-do-2-label" />
		</div>
	);
}
