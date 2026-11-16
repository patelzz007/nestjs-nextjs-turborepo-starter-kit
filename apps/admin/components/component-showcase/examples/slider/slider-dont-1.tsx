import * as React from "react";
import { Slider } from "@workspace/ui/components/slider";

export function SliderDont1Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-xs">
			<Slider defaultValue={60} max={100} aria-label="Volume" />
		</div>
	);
}
